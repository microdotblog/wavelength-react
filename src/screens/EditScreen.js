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
import PlaybackWaveform from '../components/PlaybackWaveform';
import SegmentList from '../components/SegmentList';
import { format_duration } from '../lib/format_duration';
import { use_episode_playback } from '../hooks/use_episode_playback';
import { header_right_element } from '../theme/wavelengthTheme';

function build_ios_episode_header_items({ is_editing_title, on_delete, on_rename, on_save }) {
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
  ];
}

function clip_meta_snapshot(episode) {
  return episode.clip_meta.map(clip => ({
    duration_seconds: clip.duration_seconds,
    name: clip.name,
    waveform: clip.waveform.slice(),
  }));
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

  React.useLayoutEffect(() => {
    if (Platform.OS === 'ios') {
      navigation.setOptions({
        headerRight: undefined,
        unstable_headerRightItems: () =>
          build_ios_episode_header_items({
            is_editing_title,
            on_delete: () => delete_handler_ref.current?.(),
            on_rename: () => rename_handler_ref.current?.(),
            on_save: () => save_handler_ref.current?.(),
          }),
      });
      return;
    }

    navigation.setOptions({
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
          <EpisodeActionsMenuButton
            on_delete={() => delete_handler_ref.current?.()}
            on_rename={() => rename_handler_ref.current?.()}
            theme={theme}
          />
        ),
      ),
    });
  }, [navigation, is_editing_title, theme]);

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
  const clip_count_label = clip_count === 1 ? '1 clip' : `${clip_count} clips`;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      style={[styles.screen, { backgroundColor: theme.colors.canvas }]}
    >
      <View style={styles.header}>
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
            style={[styles.title, { color: theme.colors.ink }]}
            value={title_draft}
          />
        ) : (
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: theme.colors.ink }]}
          >
            {episode.title}
          </Text>
        )}
        <Text style={[styles.subtitle, { color: theme.colors.ink_soft }]}>
          {clip_count_label}
          {'  ·  '}
          {total_label}
        </Text>
      </View>

      <View
        style={[
          styles.panel,
          {
            backgroundColor: theme.colors.paper,
            borderColor: theme.colors.line,
          },
        ]}
      >
        <PlaybackWaveform
          current_time={playback.current_time}
          duration_seconds={total_seconds}
          is_playing={playback.playing}
          onSeek={handle_seek}
          theme={theme}
          waveform={episode.waveform}
        />

        <View style={styles.timeRow}>
          <Text style={[styles.timeLabel, { color: theme.colors.ink_soft }]}>
            {elapsed_label}
          </Text>
          <Text style={[styles.timeLabel, { color: theme.colors.ink_soft }]}>
            {total_label}
          </Text>
        </View>

        <Pressable
          accessibilityLabel={playback.playing ? 'Pause' : 'Play'}
          accessibilityRole="button"
          onPress={toggle_playback}
          style={({ pressed }) => [
            styles.playButton,
            { backgroundColor: theme.colors.accent },
            pressed ? styles.pressed : null,
          ]}
        >
          <Text style={[styles.playButtonText, { color: theme.colors.button_text }]}>
            {playback.playing ? 'Pause' : 'Play'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.segmentsSection}>
        <Text style={[styles.sectionLabel, { color: theme.colors.ink_soft }]}>
          Segments
        </Text>
        <SegmentList
          clips={episode.clip_meta}
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
            styles.segmentActionRow,
            {
              backgroundColor: theme.colors.glass,
              borderColor: theme.colors.line,
            },
            pressed ? styles.pressed : null,
          ]}
        >
          <Text style={[styles.addSegmentGlyph, { color: theme.colors.accent_strong }]}>+</Text>
          <Text style={[styles.segmentActionLabel, { color: theme.colors.accent_strong }]}>
            Add segment
          </Text>
        </Pressable>
      </View>

      <View style={[styles.separator, { backgroundColor: theme.colors.line }]} />

      <Pressable
        accessibilityRole="button"
        onPress={open_publish}
        style={({ pressed }) => [
          styles.publishButton,
          { backgroundColor: theme.colors.accent },
          pressed ? styles.pressed : null,
        ]}
      >
        <Text style={[styles.publishButtonText, { color: theme.colors.button_text }]}>
          Publish to Micro.blog
        </Text>
      </Pressable>
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
  segmentActionLabel: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 19,
  },
  segmentActionRow: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 46,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  content: {
    gap: 18,
    paddingBottom: 36,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  header: {
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
  panel: {
    borderCurve: 'continuous',
    borderRadius: 26,
    borderWidth: 1,
    gap: 16,
    padding: 20,
  },
  playButton: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 18,
    justifyContent: 'center',
    minHeight: 52,
  },
  playButtonText: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
  },
  publishButton: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 18,
    justifyContent: 'center',
    minHeight: 52,
  },
  publishButtonText: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
  },
  pressed: {
    opacity: 0.72,
  },
  screen: {
    flex: 1,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 4,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.6,
    lineHeight: 16,
    textTransform: 'uppercase',
  },
  segmentsSection: {
    gap: 10,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  timeLabel: {
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
    lineHeight: 17,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 29,
    padding: 0,
  },
});

export default observer(EditScreen);
