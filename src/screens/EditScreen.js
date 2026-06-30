import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { observer } from 'mobx-react';

import { fetch_micropub_post_source } from '../api/Micropub';
import Episodes from '../stores/Episodes';
import Auth from '../stores/Auth';
import Posts from '../stores/Posts';
import Tokens from '../stores/Tokens';
import DeleteEpisodeModal from '../components/DeleteEpisodeModal';
import EpisodeActionsMenuButton from '../components/EpisodeActionsMenuButton';
import HeaderPillButton from '../components/HeaderPillButton';
import PlaybackControlButton from '../components/PlaybackControlButton';
import PlaybackWaveform from '../components/PlaybackWaveform';
import SegmentList from '../components/SegmentList';
import { format_duration } from '../lib/format_duration';
import { format_post_date } from '../lib/micropub_posts';
import { show_toast } from '../lib/toast';
import { use_episode_playback } from '../hooks/use_episode_playback';
import { header_right_element, with_color_opacity } from '../theme/wavelengthTheme';

const PLAYBACK_WAVEFORM_HEIGHT = 80;

const EMPTY_PUBLISHED_POST_DETAILS = {
  is_loading: false,
  post_uid: '',
  summary: '',
  title: '',
};

function merge_published_post_details({ cached_post = null, post_id = '', source = null } = {}) {
  return {
    post_uid: `${post_id || cached_post?.uid || source?.uid || ''}`.trim(),
    summary: `${source?.summary || ''}`.trim(),
    title: `${cached_post?.title || source?.title || ''}`.trim(),
  };
}

function build_ios_episode_header_items({
  is_editing_title,
  is_published,
  on_delete,
  on_duplicate,
  on_publish,
  on_rename,
  on_save,
}) {
  if (is_editing_title) {
    return [
      {
        accessibilityLabel: 'Save episode name',
        label: 'Save',
        onPress: on_save,
        type: 'button',
        variant: 'done',
      },
    ];
  }

  const menu_items = [
    {
      icon: { name: 'pencil', type: 'sfSymbol' },
      label: 'Rename',
      onPress: on_rename,
      type: 'action',
    },
  ];

  if (is_published) {
    menu_items.push({
      icon: { name: 'plus.square.on.square', type: 'sfSymbol' },
      label: 'Duplicate',
      onPress: on_duplicate,
      type: 'action',
    });
  }

  menu_items.push({
    destructive: true,
    icon: { name: 'trash', type: 'sfSymbol' },
    label: 'Delete Episode',
    onPress: on_delete,
    type: 'action',
  });

  const header_items = [
    {
      accessibilityLabel: 'Episode actions',
      icon: { name: 'ellipsis.circle', type: 'sfSymbol' },
      label: '',
      menu: {
        items: menu_items,
        title: 'Episode',
      },
      type: 'menu',
    },
  ];

  if (!is_published) {
    header_items.push({
      accessibilityLabel: 'Publish episode to Micro.blog',
      label: 'Publish',
      onPress: on_publish,
      type: 'button',
      variant: 'done',
    });
  }

  return header_items;
}

function clip_meta_snapshot(episode) {
  return episode.clip_meta.map(clip => ({
    duration_seconds: clip.duration_seconds,
    name: clip.name,
    waveform: clip.waveform.slice(),
  }));
}

function resolve_active_clip_index({ clip_count, current_clip_index, current_time, playing, total_duration }) {
  if (clip_count <= 0) {
    return -1;
  }

  if (playing) {
    return current_clip_index;
  }

  if (current_time > 0 && total_duration > 0 && current_time < total_duration) {
    return current_clip_index;
  }

  return -1;
}

function resolve_playback_status_label({
  clip_count,
  current_clip_index,
  current_time,
  playing,
  total_duration,
}) {
  if (playing) {
    if (clip_count <= 1) {
      return 'Playing preview';
    }

    return `Playing segment ${current_clip_index + 1} of ${clip_count}`;
  }

  if (current_time > 0 && total_duration > 0 && current_time < total_duration) {
    return `Paused at ${format_duration(current_time)}`;
  }

  return 'Tap play to preview';
}

function EditScreen({ navigation, route, theme }) {
  const episode_id = route.params?.episode_id;
  const episode = Episodes.get_episode(episode_id);
  const playback = use_episode_playback(episode ? episode.playback_clips() : []);
  const [title_draft, set_title_draft] = React.useState(episode?.title || '');
  const [is_editing_title, set_is_editing_title] = React.useState(false);
  const [is_delete_modal_visible, set_is_delete_modal_visible] = React.useState(false);
  const [is_deleting_episode, set_is_deleting_episode] = React.useState(false);
  const [is_duplicating_episode, set_is_duplicating_episode] = React.useState(false);
  const [published_post_details, set_published_post_details] = React.useState(EMPTY_PUBLISHED_POST_DETAILS);
  const save_handler_ref = React.useRef(null);
  const rename_handler_ref = React.useRef(null);
  const delete_handler_ref = React.useRef(null);
  const publish_handler_ref = React.useRef(null);
  const duplicate_handler_ref = React.useRef(null);
  const playback_play_ref = React.useRef(null);

  playback_play_ref.current = playback.play;

  React.useEffect(() => {
    if (!is_editing_title) {
      set_title_draft(episode?.title || '');
    }
  }, [episode?.title, is_editing_title]);

  React.useEffect(() => {
    if (!route.params?.start_rename || !episode) {
      return;
    }

    set_title_draft(episode.title);
    set_is_editing_title(true);
    navigation.setParams({ start_rename: undefined });
  }, [episode, navigation, route.params?.start_rename]);

  React.useEffect(() => {
    if (!route.params?.autoplay || !episode) {
      return;
    }

    playback_play_ref.current?.();
    navigation.setParams({ autoplay: undefined });
  }, [episode?.id, navigation, route.params?.autoplay]);

  React.useEffect(() => {
    const post_id = `${episode?.post_id || ''}`.trim();
    const post_url = `${episode?.post_url || ''}`.trim();
    const is_episode_published = post_id.length > 0 || post_url.length > 0;

    if (!is_episode_published) {
      set_published_post_details(EMPTY_PUBLISHED_POST_DETAILS);
      return undefined;
    }

    let cancelled = false;

    async function load_published_post_details() {
      set_published_post_details(current => ({
        ...current,
        is_loading: true,
      }));

      await Posts.refresh();

      if (cancelled) {
        return;
      }

      const cached_post = Posts.get_post(post_id);
      let merged = merge_published_post_details({
        cached_post,
        post_id,
        source: null,
      });

      if (post_url && Tokens.get_user_token()) {
        try {
          const source = await fetch_micropub_post_source({
            destination: `${Auth.default_site || ''}`.trim(),
            post_url,
            token: Tokens.get_user_token(),
          });

          if (!cancelled && source) {
            merged = merge_published_post_details({
              cached_post,
              post_id,
              source,
            });
          }
        } catch {
          // ponytail: cached post title still renders if source fetch fails.
        }
      }

      if (!cancelled) {
        set_published_post_details({
          ...merged,
          is_loading: false,
        });
      }
    }

    load_published_post_details();

    return () => {
      cancelled = true;
    };
  }, [episode?.id, episode?.post_id, episode?.post_url]);

  function toggle_playback() {
    if (playback.playing) {
      playback.pause();
    } else {
      playback.play();
    }
  }

  function handle_seek(fraction) {
    const basis = playback.total_duration > 0 ? playback.total_duration : 0;

    if (basis <= 0) {
      return;
    }

    playback.seek(fraction * basis);
  }

  function open_split(clip) {
    if (!episode || episode.is_published()) {
      return;
    }

    navigation.navigate('Split', { clip_name: clip.name, episode_id });
  }

  function add_segment() {
    if (!episode || episode.is_published()) {
      return;
    }

    navigation.navigate('Record', { episode_id });
  }

  function open_publish() {
    if (episode?.is_published()) {
      return;
    }

    navigation.navigate('Publish', { episode_id });
  }

  async function duplicate_episode() {
    if (!episode || is_duplicating_episode) {
      return;
    }

    set_is_duplicating_episode(true);

    try {
      const duplicate_id = await Episodes.duplicate_episode(episode_id);
      navigation.replace('Edit', { episode_id: duplicate_id });
    } catch (error) {
      Alert.alert(
        'Could not duplicate episode',
        error?.message || 'Please try again.',
      );
    } finally {
      set_is_duplicating_episode(false);
    }
  }

  async function move_clip(index, target_index) {
    if (!episode || episode.is_published()) {
      return;
    }

    const clips = clip_meta_snapshot(episode);

    if (target_index < 0 || target_index >= clips.length) {
      return;
    }

    const [moved] = clips.splice(index, 1);
    clips.splice(target_index, 0, moved);

    await Episodes.update_episode_clips(episode_id, clips);
    Episodes.export_merged_audio(episode_id);
  }

  async function reorder_clips(next_order) {
    if (!episode || episode.is_published()) {
      return;
    }

    const clips = clip_meta_snapshot(episode);
    const current_order = clips.map(clip => clip.name);

    if (next_order.length !== current_order.length) {
      return;
    }

    const is_unchanged = next_order.every((name, index) => name === current_order[index]);

    if (is_unchanged) {
      return;
    }

    const clips_by_name = new Map(clips.map(clip => [clip.name, clip]));
    const reordered = next_order.map(name => clips_by_name.get(name)).filter(Boolean);

    if (reordered.length !== clips.length) {
      return;
    }

    await Episodes.update_episode_clips(episode_id, reordered);
    Episodes.export_merged_audio(episode_id);
  }

  async function delete_clip(index) {
    if (!episode || episode.is_published()) {
      return;
    }

    const clips = clip_meta_snapshot(episode).filter((_, clip_index) => clip_index !== index);

    await Episodes.update_episode_clips(episode_id, clips);
    Episodes.export_merged_audio(episode_id);
  }

  function confirm_delete_clip(index) {
    if (episode.clips.length <= 1) {
      confirm_delete_episode();
      return;
    }

    Alert.alert(
      'Delete segment?',
      'This removes the segment from this episode.',
      [
        {
          style: 'cancel',
          text: 'Cancel',
        },
        {
          onPress: () => delete_clip(index),
          style: 'destructive',
          text: 'Delete',
        },
      ],
    );
  }

  function confirm_delete_episode() {
    set_is_delete_modal_visible(true);
  }

  async function handle_delete_episode(delete_post = false) {
    set_is_deleting_episode(true);

    try {
      await Episodes.delete_episode(episode_id, { delete_post });
      set_is_delete_modal_visible(false);
      show_toast(
        delete_post
          ? 'Episode and post deleted.'
          : (episode?.is_published?.() ? 'Episode removed from device.' : 'Episode deleted.'),
      );
      navigation.goBack();
    } catch (error) {
      show_toast(error?.message || 'Could not delete episode. Please try again.');
    } finally {
      set_is_deleting_episode(false);
    }
  }

  function close_delete_modal() {
    if (is_deleting_episode) {
      return;
    }

    set_is_delete_modal_visible(false);
  }

  function start_rename() {
    if (!episode) {
      return;
    }

    set_title_draft(episode.title);
    set_is_editing_title(true);
  }

  async function commit_title() {
    set_is_editing_title(false);

    if (!episode) {
      return;
    }

    const trimmed_title = title_draft.trim();

    if (!trimmed_title || trimmed_title === episode.title) {
      set_title_draft(episode.title);
      return;
    }

    await Episodes.update_episode_title(episode_id, trimmed_title);
  }

  save_handler_ref.current = commit_title;
  rename_handler_ref.current = start_rename;
  delete_handler_ref.current = confirm_delete_episode;
  publish_handler_ref.current = open_publish;
  duplicate_handler_ref.current = duplicate_episode;

  const navigation_title = is_editing_title ? 'Rename' : (episode?.title || 'Episode');
  const is_published = episode?.is_published() ?? false;

  React.useLayoutEffect(() => {
    if (Platform.OS === 'ios') {
      navigation.setOptions({
        headerLargeTitle: false,
        headerRight: undefined,
        title: navigation_title,
        unstable_headerRightItems: () =>
          build_ios_episode_header_items({
            is_editing_title,
            is_published,
            on_delete: () => delete_handler_ref.current?.(),
            on_duplicate: () => duplicate_handler_ref.current?.(),
            on_publish: () => publish_handler_ref.current?.(),
            on_rename: () => rename_handler_ref.current?.(),
            on_save: () => save_handler_ref.current?.(),
          }),
      });
      return;
    }

    navigation.setOptions({
      headerLargeTitle: false,
      title: navigation_title,
      unstable_headerRightItems: undefined,
      ...header_right_element(() =>
        is_editing_title ? (
          <HeaderPillButton
            accessibilityLabel="Save episode name"
            label="Save"
            onPress={() => save_handler_ref.current?.()}
            theme={theme}
          />
        ) : (
          <View style={styles.headerActions}>
            {!is_published ? (
              <HeaderPillButton
                accessibilityLabel="Publish episode to Micro.blog"
                label="Publish"
                onPress={() => publish_handler_ref.current?.()}
                theme={theme}
              />
            ) : null}
            <EpisodeActionsMenuButton
              is_published={is_published}
              on_delete={() => delete_handler_ref.current?.()}
              on_duplicate={() => duplicate_handler_ref.current?.()}
              on_rename={() => rename_handler_ref.current?.()}
              theme={theme}
            />
          </View>
        ),
      ),
    });
  }, [navigation, is_editing_title, is_published, navigation_title, theme]);

  if (!episode) {
    return (
      <View style={[styles.screen, styles.missingScreen, { backgroundColor: theme.colors.canvas }]}>
        <Text style={[styles.missingText, { color: theme.colors.ink_soft }]}>
          This episode is no longer available.
        </Text>
      </View>
    );
  }

  const total_seconds = playback.total_duration > 0 ? playback.total_duration : episode.duration_seconds;
  const elapsed_label = format_duration(playback.current_time);
  const total_label = format_duration(total_seconds);
  const clip_count = episode.clips.length;
  const segment_count_label = clip_count === 1 ? '1 segment' : `${clip_count} segments`;
  const playback_status_label = resolve_playback_status_label({
    clip_count,
    current_clip_index: playback.current_clip_index,
    current_time: playback.current_time,
    playing: playback.playing,
    total_duration: total_seconds,
  });
  const active_clip_index = resolve_active_clip_index({
    clip_count,
    current_clip_index: playback.current_clip_index,
    current_time: playback.current_time,
    playing: playback.playing,
    total_duration: total_seconds,
  });
  const published_label = format_post_date(episode.published_at || '');
  const post_url = `${episode.post_url || ''}`.trim();
  const published_post_title = published_post_details.title || 'Microcast';
  const published_post_summary = published_post_details.summary;
  const published_post_uid = published_post_details.post_uid;

  function open_published_post() {
    if (!post_url) {
      return;
    }

    Linking.openURL(post_url);
  }

  function open_post_edit() {
    if (!published_post_uid) {
      return;
    }

    navigation.navigate('PostEdit', { episode_id, post_uid: published_post_uid });
  }

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        style={[styles.screen, { backgroundColor: theme.colors.canvas }]}
      >
      {is_editing_title ? (
        <TextInput
          accessibilityLabel="Episode name"
          autoFocus
          clearButtonMode="while-editing"
          keyboardAppearance={theme.is_dark ? 'dark' : 'light'}
          onBlur={commit_title}
          onChangeText={set_title_draft}
          onSubmitEditing={commit_title}
          placeholder="Episode name"
          placeholderTextColor={theme.colors.ink_soft}
          returnKeyType="done"
          selectionColor={theme.colors.accent}
          style={[styles.renameInput, { color: theme.colors.ink }]}
          value={title_draft}
        />
      ) : (
        <View style={styles.heroHeader}>
          <Text style={[styles.episodeTitle, { color: theme.colors.ink }]}>
            {episode.title}
          </Text>
          <Text style={[styles.episodeMeta, { color: theme.colors.ink_soft }]}>
            {segment_count_label}
            {' · '}
            {total_label}
            {is_published ? (
              <>
                {' · '}
                {published_label.length > 0 ? published_label : 'Published'}
              </>
            ) : null}
          </Text>
        </View>
      )}

      {is_published ? (
        <View style={styles.publishedSection}>
          <Text style={[styles.sectionTitle, { color: theme.colors.ink }]}>
            On Micro.blog
          </Text>

          {post_url.length > 0 ? (
            <Pressable
              accessibilityLabel="View published post on Micro.blog"
              accessibilityRole="button"
              onPress={open_published_post}
              style={({ pressed }) => [
                styles.publishedPostCard,
                {
                  backgroundColor: theme.colors.paper,
                  borderColor: theme.colors.line,
                },
                pressed ? styles.pressed : null,
              ]}
            >
              {published_post_details.is_loading ? (
                <View style={styles.publishedLoadingRow}>
                  <ActivityIndicator color={theme.colors.accent} size="small" />
                  <Text style={[styles.publishedLoadingLabel, { color: theme.colors.ink_soft }]}>
                    Loading post…
                  </Text>
                </View>
              ) : (
                <>
                  <View style={styles.publishedPostCopy}>
                    <Text numberOfLines={1} style={[styles.publishedPostTitle, { color: theme.colors.ink }]}>
                      {published_post_title}
                    </Text>
                    {published_post_summary.length > 0 ? (
                      <Text
                        numberOfLines={2}
                        style={[styles.publishedPostSummary, { color: theme.colors.ink_soft }]}
                      >
                        {published_post_summary}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={[styles.publishedPostChevron, { color: theme.colors.ink_soft }]}>
                    ›
                  </Text>
                </>
              )}
            </Pressable>
          ) : (
            <View
              style={[
                styles.publishedPostCard,
                {
                  backgroundColor: theme.colors.paper,
                  borderColor: theme.colors.line,
                },
              ]}
            >
              {published_post_details.is_loading ? (
                <View style={styles.publishedLoadingRow}>
                  <ActivityIndicator color={theme.colors.accent} size="small" />
                  <Text style={[styles.publishedLoadingLabel, { color: theme.colors.ink_soft }]}>
                    Loading post…
                  </Text>
                </View>
              ) : (
                <View style={styles.publishedPostCopy}>
                  <Text numberOfLines={1} style={[styles.publishedPostTitle, { color: theme.colors.ink }]}>
                    {published_post_title}
                  </Text>
                  {published_post_summary.length > 0 ? (
                    <Text
                      numberOfLines={2}
                      style={[styles.publishedPostSummary, { color: theme.colors.ink_soft }]}
                    >
                      {published_post_summary}
                    </Text>
                  ) : null}
                </View>
              )}
            </View>
          )}

          {published_post_uid.length > 0 ? (
            <Pressable
              accessibilityLabel="Edit published post"
              accessibilityRole="button"
              onPress={open_post_edit}
              style={({ pressed }) => [styles.publishedSecondaryAction, pressed ? styles.pressed : null]}
            >
              <Text style={[styles.publishedSecondaryActionLabel, { color: theme.colors.accent_strong }]}>
                Edit post
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View
        style={[
          styles.playbackPanel,
          {
            backgroundColor: theme.colors.paper,
            borderColor: theme.colors.line,
          },
        ]}
      >
        <PlaybackWaveform
          bar_area_height={PLAYBACK_WAVEFORM_HEIGHT}
          current_time={playback.current_time}
          duration_seconds={total_seconds}
          is_playing={playback.playing}
          onSeek={handle_seek}
          theme={theme}
          waveform={episode.waveform}
        />

        <View style={styles.transportRow}>
          <PlaybackControlButton
            is_playing={playback.playing}
            onPress={toggle_playback}
            theme={theme}
          />

          <View style={styles.transportCopy}>
            <Text style={[styles.transportTime, { color: theme.colors.ink }]}>
              {elapsed_label}
              {' / '}
              {total_label}
            </Text>
            <Text style={[styles.transportStatus, { color: theme.colors.ink_soft }]}>
              {playback_status_label}
            </Text>
          </View>
        </View>
      </View>

      <View
        style={[
          styles.segmentsPanel,
          {
            backgroundColor: theme.colors.paper_alt,
            borderColor: theme.colors.line,
          },
        ]}
      >
        <SegmentList
          active_clip_index={active_clip_index}
          clips={episode.clip_meta}
          grouped
          onDelete={confirm_delete_clip}
          onMove={move_clip}
          onReorder={reorder_clips}
          onSplit={open_split}
          readOnly={is_published}
          theme={theme}
        />

        {is_published ? (
          <Pressable
            accessibilityRole="button"
            disabled={is_duplicating_episode}
            onPress={duplicate_episode}
            style={({ pressed }) => [
              styles.secondarySegmentRow,
              {
                backgroundColor: theme.colors.glass,
                borderTopColor: theme.colors.line,
              },
              pressed && !is_duplicating_episode ? styles.pressed : null,
              is_duplicating_episode ? styles.disabledRow : null,
            ]}
          >
            <Text style={[styles.secondarySegmentLabel, { color: theme.colors.ink_soft }]}>
              {is_duplicating_episode ? 'Duplicating…' : 'Duplicate to edit'}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={add_segment}
            style={({ pressed }) => [
              styles.addSegmentRow,
              {
                backgroundColor: with_color_opacity(theme.colors.accent, theme.is_dark ? 0.14 : 0.08),
                borderTopColor: theme.colors.line,
              },
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={[styles.addSegmentGlyph, { color: theme.colors.accent_strong }]}>+</Text>
            <Text style={[styles.addSegmentLabel, { color: theme.colors.accent_strong }]}>
              Record another take
            </Text>
          </Pressable>
        )}
      </View>
      </ScrollView>

      <DeleteEpisodeModal
        episode_title={episode.title}
        has_published_post={is_published}
        is_busy={is_deleting_episode}
        on_cancel={close_delete_modal}
        on_delete_device_and_post={() => handle_delete_episode(true)}
        on_delete_device_only={() => handle_delete_episode(false)}
        theme={theme}
        visible={is_delete_modal_visible}
      />
    </>
  );
}

const styles = StyleSheet.create({
  addSegmentGlyph: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 24,
    width: 18,
  },
  addSegmentLabel: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 19,
  },
  addSegmentRow: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  content: {
    gap: 20,
    paddingBottom: 36,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  disabledRow: {
    opacity: 0.5,
  },
  episodeMeta: {
    fontSize: 15,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
    lineHeight: 20,
  },
  episodeTitle: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 29,
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  heroHeader: {
    gap: 6,
    paddingHorizontal: 4,
  },
  missingScreen: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  missingText: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    textAlign: 'center',
  },
  playbackPanel: {
    borderCurve: 'continuous',
    borderRadius: 26,
    borderWidth: 1,
    gap: 16,
    padding: 20,
  },
  pressed: {
    opacity: 0.72,
  },
  publishedLoadingLabel: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  publishedLoadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  publishedPostCard: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 68,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  publishedPostChevron: {
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 28,
  },
  publishedPostCopy: {
    flex: 1,
    gap: 4,
  },
  publishedPostSummary: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
  },
  publishedPostTitle: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
  },
  publishedSecondaryAction: {
    alignSelf: 'flex-start',
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  publishedSecondaryActionLabel: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 19,
  },
  publishedSection: {
    gap: 10,
  },
  renameInput: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 29,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  screen: {
    flex: 1,
  },
  secondarySegmentLabel: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 19,
  },
  secondarySegmentRow: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 19,
    paddingHorizontal: 4,
  },
  segmentsPanel: {
    borderCurve: 'continuous',
    borderRadius: 26,
    borderWidth: 1,
    overflow: 'hidden',
  },
  transportCopy: {
    flex: 1,
    gap: 4,
  },
  transportRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
  },
  transportStatus: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  transportTime: {
    fontSize: 17,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
    lineHeight: 22,
  },
});

export default observer(EditScreen);
