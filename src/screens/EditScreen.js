import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { observer } from 'mobx-react';

import Episodes from '../stores/Episodes';
import PlaybackWaveform from '../components/PlaybackWaveform';
import SegmentRow from '../components/SegmentRow';
import { format_duration } from '../lib/format_duration';
import { use_episode_playback } from '../hooks/use_episode_playback';
import { with_color_opacity } from '../theme/wavelengthTheme';

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
      <View
        style={[
          styles.panel,
          {
            backgroundColor: theme.colors.paper,
            borderColor: theme.colors.line,
          },
        ]}
      >
        <Text selectable style={[styles.title, { color: theme.colors.ink }]}>
          {episode.title}
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.ink_soft }]}>
          {clip_count_label}
          {'  ·  '}
          {total_label}
        </Text>

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
        {episode.clip_meta.map((clip, index) => (
          <SegmentRow
            clip={clip}
            index={index}
            key={clip.name}
            onDelete={() => confirm_delete_clip(index)}
            onMoveDown={() => move_clip(index, index + 1)}
            onMoveUp={() => move_clip(index, index - 1)}
            onPress={() => open_split(clip)}
            theme={theme}
            total={clip_count}
          />
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={add_segment}
        style={({ pressed }) => [
          styles.addButton,
          { backgroundColor: theme.colors.accent },
          pressed ? styles.pressed : null,
        ]}
      >
        <Text style={[styles.addButtonText, { color: theme.colors.button_text }]}>
          Add segment
        </Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={confirm_delete_episode}
        style={({ pressed }) => [
          styles.deleteButton,
          {
            backgroundColor: with_color_opacity(theme.colors.accent, theme.is_dark ? 0.16 : 0.1),
            borderColor: theme.colors.line,
          },
          pressed ? styles.pressed : null,
        ]}
      >
        <Text style={[styles.deleteButtonText, { color: theme.colors.accent_strong }]}>
          Delete episode
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  addButton: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 18,
    justifyContent: 'center',
    minHeight: 52,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 20,
  },
  content: {
    gap: 18,
    paddingBottom: 36,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  deleteButton: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 20,
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
  pressed: {
    opacity: 0.72,
  },
  screen: {
    flex: 1,
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
  },
});

export default observer(EditScreen);
