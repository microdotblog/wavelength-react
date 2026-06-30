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

function PublishedPostActionRow({ accessibility_label, label, onPress, theme }) {
  return (
    <Pressable
      accessibilityLabel={accessibility_label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.publishedLinkRow,
        {
          backgroundColor: with_color_opacity(theme.colors.accent, theme.is_dark ? 0.12 : 0.06),
          borderColor: theme.colors.line,
        },
        pressed ? styles.pressed : null,
      ]}
    >
      <Text style={[styles.publishedLinkLabel, { color: theme.colors.accent_strong }]}>
        {label}
      </Text>
      <Text style={[styles.publishedLinkChevron, { color: theme.colors.accent_strong }]}>
        ›
      </Text>
    </Pressable>
  );
}

function build_ios_episode_header_items({
  is_editing_title,
  on_delete,
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

  return [
    {
      accessibilityLabel: 'Episode actions',
      icon: { name: 'ellipsis.circle', type: 'sfSymbol' },
      label: '',
      menu: {
        items: [
          {
            icon: { name: 'pencil', type: 'sfSymbol' },
            label: 'Rename',
            onPress: on_rename,
            type: 'action',
          },
          {
            destructive: true,
            icon: { name: 'trash', type: 'sfSymbol' },
            label: 'Delete Episode',
            onPress: on_delete,
            type: 'action',
          },
        ],
        title: 'Episode',
      },
      type: 'menu',
    },
    {
      accessibilityLabel: 'Publish episode to Micro.blog',
      label: 'Publish',
      onPress: on_publish,
      type: 'button',
      variant: 'done',
    },
  ];
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
  const [published_post_details, set_published_post_details] = React.useState(EMPTY_PUBLISHED_POST_DETAILS);
  const save_handler_ref = React.useRef(null);
  const rename_handler_ref = React.useRef(null);
  const delete_handler_ref = React.useRef(null);
  const publish_handler_ref = React.useRef(null);

  React.useEffect(() => {
    if (!is_editing_title) {
      set_title_draft(episode?.title || '');
    }
  }, [episode?.title, is_editing_title]);

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
    navigation.navigate('Split', { clip_name: clip.name, episode_id });
  }

  function add_segment() {
    navigation.navigate('Record', { episode_id });
  }

  function open_publish() {
    navigation.navigate('Publish', { episode_id });
  }

  async function move_clip(index, target_index) {
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
      navigation.goBack();
    } catch (error) {
      Alert.alert(
        'Could not delete episode',
        error?.message || 'Please try again.',
      );
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

  const navigation_title = is_editing_title ? 'Rename' : (episode?.title || 'Episode');

  React.useLayoutEffect(() => {
    if (Platform.OS === 'ios') {
      navigation.setOptions({
        headerLargeTitle: false,
        headerRight: undefined,
        title: navigation_title,
        unstable_headerRightItems: () =>
          build_ios_episode_header_items({
            is_editing_title,
            on_delete: () => delete_handler_ref.current?.(),
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
            <HeaderPillButton
              accessibilityLabel="Publish episode to Micro.blog"
              label="Publish"
              onPress={() => publish_handler_ref.current?.()}
              theme={theme}
            />
            <EpisodeActionsMenuButton
              on_delete={() => delete_handler_ref.current?.()}
              on_rename={() => rename_handler_ref.current?.()}
              theme={theme}
            />
          </View>
        ),
      ),
    });
  }, [navigation, is_editing_title, navigation_title, theme]);

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
  const is_published = episode.is_published();
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
          </Text>
        </View>
      )}

      {is_published ? (
        <View
          style={[
            styles.publishedPanel,
            {
              backgroundColor: theme.colors.paper,
              borderColor: theme.colors.line,
            },
          ]}
        >
          <View style={styles.publishedHeader}>
            <View style={[styles.publishedBadge, { backgroundColor: theme.colors.accent_soft }]}>
              <Text style={[styles.publishedBadgeLabel, { color: theme.colors.accent_strong }]}>
                Published
              </Text>
            </View>
            {published_label.length > 0 ? (
              <Text style={[styles.publishedDate, { color: theme.colors.ink_soft }]}>
                {published_label}
              </Text>
            ) : null}
          </View>

          {published_post_details.is_loading ? (
            <View style={styles.publishedLoadingRow}>
              <ActivityIndicator color={theme.colors.accent} size="small" />
              <Text style={[styles.publishedLoadingLabel, { color: theme.colors.ink_soft }]}>
                Loading post details…
              </Text>
            </View>
          ) : (
            <View style={styles.publishedCopy}>
              <Text style={[styles.publishedPostTitle, { color: theme.colors.ink }]}>
                {published_post_title}
              </Text>
              {published_post_summary.length > 0 ? (
                <Text style={[styles.publishedPostSummary, { color: theme.colors.ink_soft }]}>
                  {published_post_summary}
                </Text>
              ) : null}
            </View>
          )}

          <View style={styles.publishedActions}>
            {post_url.length > 0 ? (
              <PublishedPostActionRow
                accessibility_label="View published post on Micro.blog"
                label="View on Micro.blog"
                onPress={open_published_post}
                theme={theme}
              />
            ) : null}
            {published_post_uid.length > 0 ? (
              <PublishedPostActionRow
                accessibility_label="Edit published post"
                label="Edit post"
                onPress={open_post_edit}
                theme={theme}
              />
            ) : null}
          </View>
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
          theme={theme}
        />

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
  publishedBadge: {
    borderCurve: 'continuous',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  publishedBadgeLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
    lineHeight: 14,
    textTransform: 'uppercase',
  },
  publishedDate: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'right',
  },
  publishedHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  publishedActions: {
    gap: 8,
  },
  publishedCopy: {
    gap: 6,
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
  },
  publishedPostSummary: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 21,
  },
  publishedPostTitle: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },
  publishedLinkChevron: {
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 26,
  },
  publishedLinkLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 19,
  },
  publishedLinkRow: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  publishedPanel: {
    borderCurve: 'continuous',
    borderRadius: 26,
    borderWidth: 1,
    gap: 12,
    padding: 16,
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
