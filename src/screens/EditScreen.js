import React from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { observer } from 'mobx-react';

import Episodes from '../stores/Episodes';
import EpisodeActionsMenuButton from '../components/EpisodeActionsMenuButton';
import HeaderPillButton from '../components/HeaderPillButton';
import PlaybackControlButton from '../components/PlaybackControlButton';
import PlaybackWaveform from '../components/PlaybackWaveform';
import SegmentList from '../components/SegmentList';
import { format_duration } from '../lib/format_duration';
import { use_episode_playback } from '../hooks/use_episode_playback';
import { header_right_element, with_color_opacity } from '../theme/wavelengthTheme';

const PLAYBACK_WAVEFORM_HEIGHT = 80;

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
  if (clip_count <= 0 || playing) {
    return -1;
  }

  if (current_time > 0 && total_duration > 0 && current_time < total_duration) {
    return current_clip_index;
  }

  return -1;
}

function resolve_playback_status_label({ current_time, playing, total_duration }) {
  if (playing) {
    return 'Playing preview';
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
  const save_handler_ref = React.useRef(null);
  const rename_handler_ref = React.useRef(null);
  const delete_handler_ref = React.useRef(null);
  const publish_handler_ref = React.useRef(null);

  React.useEffect(() => {
    if (!is_editing_title) {
      set_title_draft(episode?.title || '');
    }
  }, [episode?.title, is_editing_title]);

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
    Alert.alert(
      'Delete episode?',
      'This permanently removes the recording from this device.',
      [
        {
          style: 'cancel',
          text: 'Cancel',
        },
        {
          onPress: delete_episode,
          style: 'destructive',
          text: 'Delete',
        },
      ],
    );
  }

  async function delete_episode() {
    await Episodes.delete_episode(episode_id);
    navigation.goBack();
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

  return (
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
