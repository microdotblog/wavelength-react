import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { observer } from 'mobx-react';

import Episodes from '../stores/Episodes';
import { format_duration } from '../lib/format_duration';
import { with_color_opacity } from '../theme/wavelengthTheme';

function EditScreen({ navigation, route, theme }) {
  const episode_id = route.params?.episode_id;
  const episode = Episodes.get_episode(episode_id);
  const clip_uri = episode ? episode.primary_clip_uri() : null;

  const player = useAudioPlayer(clip_uri ? { uri: clip_uri } : null);
  const status = useAudioPlayerStatus(player);

  function toggle_playback() {
    if (status.playing) {
      player.pause();
      return;
    }

    if (status.duration > 0 && status.currentTime >= status.duration) {
      player.seekTo(0);
    }

    player.play();
  }

  function confirm_delete() {
    Alert.alert(
      'Delete episode?',
      'This permanently removes the recording from this device.',
      [
        {
          style: 'cancel',
          text: 'Cancel',
        },
        {
          onPress: handle_delete,
          style: 'destructive',
          text: 'Delete',
        },
      ],
    );
  }

  async function handle_delete() {
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

  const total_seconds = status.duration > 0 ? status.duration : episode.duration_seconds;
  const elapsed_label = format_duration(status.currentTime);
  const total_label = format_duration(total_seconds);
  const progress_fraction = total_seconds > 0
    ? Math.min(status.currentTime / total_seconds, 1)
    : 0;

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
          {episode.clips.length === 1 ? '1 clip' : `${episode.clips.length} clips`}
          {'  ·  '}
          {total_label}
        </Text>

        <View style={[styles.progressTrack, { backgroundColor: theme.colors.line }]}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: theme.colors.accent,
                width: `${progress_fraction * 100}%`,
              },
            ]}
          />
        </View>

        <View style={styles.timeRow}>
          <Text style={[styles.timeLabel, { color: theme.colors.ink_soft }]}>
            {elapsed_label}
          </Text>
          <Text style={[styles.timeLabel, { color: theme.colors.ink_soft }]}>
            {total_label}
          </Text>
        </View>

        <Pressable
          accessibilityLabel={status.playing ? 'Pause' : 'Play'}
          accessibilityRole="button"
          onPress={toggle_playback}
          style={({ pressed }) => [
            styles.playButton,
            { backgroundColor: theme.colors.accent },
            pressed ? styles.pressed : null,
          ]}
        >
          <Text style={[styles.playButtonText, { color: theme.colors.button_text }]}>
            {status.playing ? 'Pause' : 'Play'}
          </Text>
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={confirm_delete}
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
  progressFill: {
    borderRadius: 3,
    height: '100%',
  },
  progressTrack: {
    borderRadius: 3,
    height: 6,
    overflow: 'hidden',
    width: '100%',
  },
  screen: {
    flex: 1,
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
