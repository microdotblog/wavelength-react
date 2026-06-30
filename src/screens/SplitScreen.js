import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { observer } from 'mobx-react';

import Episodes from '../stores/Episodes';
import DeleteEpisodeModal from '../components/DeleteEpisodeModal';
import PlaybackWaveform from '../components/PlaybackWaveform';
import { place_clip_file } from '../lib/EpisodeStorage';
import { slice_waveform } from '../lib/merge_episode_waveform';
import { split_clip_at } from '../lib/episode_audio';
import { format_duration } from '../lib/format_duration';
import { show_toast } from '../lib/toast';
import { with_color_opacity } from '../theme/wavelengthTheme';

const MINIMUM_SEGMENT_SECONDS = 1;

function SplitScreen({ navigation, route, theme }) {
  const episode_id = route.params?.episode_id;
  const clip_name = route.params?.clip_name;
  const episode = Episodes.get_episode(episode_id);
  const clip_index = episode ? episode.clip_meta.findIndex(clip => clip.name === clip_name) : -1;
  const clip = clip_index >= 0 ? episode.clip_meta[clip_index] : null;
  const clip_uri = clip ? episode.clip_uri(clip_name) : null;

  const player = useAudioPlayer(clip_uri ? { uri: clip_uri } : null, { updateInterval: 100 });
  const status = useAudioPlayerStatus(player);
  const [is_busy, set_is_busy] = React.useState(false);
  const [is_delete_modal_visible, set_is_delete_modal_visible] = React.useState(false);
  const [is_deleting_episode, set_is_deleting_episode] = React.useState(false);

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

  function handle_seek(fraction) {
    if (!(clip_duration > 0)) {
      return;
    }

    player.seekTo(fraction * clip_duration);
  }

  async function perform_split(split_seconds) {
    set_is_busy(true);
    player.pause();

    try {
      const result = await split_clip_at(clip_uri, split_seconds, clip_duration);
      const first_name = await place_clip_file(episode_id, result.first_uri);
      const second_name = await place_clip_file(episode_id, result.second_uri);
      const fraction = clip_duration > 0 ? split_seconds / clip_duration : 0.5;

      const next_clips = episode.clip_meta.map(item => ({
        duration_seconds: item.duration_seconds,
        name: item.name,
        waveform: item.waveform.slice(),
      }));

      next_clips.splice(
        clip_index,
        1,
        {
          duration_seconds: result.first_seconds,
          name: first_name,
          waveform: slice_waveform(clip.waveform, 0, fraction),
        },
        {
          duration_seconds: result.second_seconds,
          name: second_name,
          waveform: slice_waveform(clip.waveform, fraction, 1),
        },
      );

      await Episodes.update_episode_clips(episode_id, next_clips);
      Episodes.export_merged_audio(episode_id);
      navigation.goBack();
    } catch (error) {
      set_is_busy(false);
      Alert.alert('Split failed', 'That segment could not be split. Please try again.');
    }
  }

  function handle_split() {
    const split_seconds = Math.min(Math.max(status.currentTime, 0), clip_duration);

    if (split_seconds < MINIMUM_SEGMENT_SECONDS || clip_duration - split_seconds < MINIMUM_SEGMENT_SECONDS) {
      Alert.alert(
        'Move the split point',
        'Each segment needs to be at least one second long.',
      );
      return;
    }

    perform_split(split_seconds);
  }

  async function delete_segment() {
    set_is_busy(true);
    player.pause();

    const next_clips = episode.clip_meta
      .filter((_, index) => index !== clip_index)
      .map(item => ({
        duration_seconds: item.duration_seconds,
        name: item.name,
        waveform: item.waveform.slice(),
      }));

    await Episodes.update_episode_clips(episode_id, next_clips);
    Episodes.export_merged_audio(episode_id);
    navigation.goBack();
  }

  async function handle_delete_episode(delete_post = false) {
    set_is_deleting_episode(true);
    player.pause();

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

  function confirm_delete_segment() {
    if (episode.clips.length <= 1) {
      set_is_delete_modal_visible(true);
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
          onPress: delete_segment,
          style: 'destructive',
          text: 'Delete',
        },
      ],
    );
  }

  if (!episode || !clip) {
    return (
      <View style={[styles.screen, styles.missingScreen, { backgroundColor: theme.colors.canvas }]}>
        <Text style={[styles.missingText, { color: theme.colors.ink_soft }]}>
          This segment is no longer available.
        </Text>
      </View>
    );
  }

  const clip_duration = status.duration > 0 ? status.duration : clip.duration_seconds;
  const split_label = format_duration(status.currentTime);
  const total_label = format_duration(clip_duration);

  return (
    <>
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
        <Text style={[styles.heading, { color: theme.colors.ink }]}>
          {`Split at ${split_label}`}
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.ink_soft }]}>
          Move the playhead to where the segment should be cut in two.
        </Text>

        <PlaybackWaveform
          current_time={status.currentTime}
          duration_seconds={clip_duration}
          is_playing={status.playing}
          onSeek={handle_seek}
          theme={theme}
          waveform={clip.waveform}
        />

        <View style={styles.timeRow}>
          <Text style={[styles.timeLabel, { color: theme.colors.ink_soft }]}>
            {split_label}
          </Text>
          <Text style={[styles.timeLabel, { color: theme.colors.ink_soft }]}>
            {total_label}
          </Text>
        </View>

        <Pressable
          accessibilityLabel={status.playing ? 'Pause' : 'Play'}
          accessibilityRole="button"
          disabled={is_busy}
          onPress={toggle_playback}
          style={({ pressed }) => [
            styles.secondaryButton,
            {
              backgroundColor: with_color_opacity(theme.colors.accent, theme.is_dark ? 0.16 : 0.1),
              borderColor: theme.colors.line,
            },
            pressed ? styles.pressed : null,
          ]}
        >
          <Text style={[styles.secondaryButtonText, { color: theme.colors.accent_strong }]}>
            {status.playing ? 'Pause' : 'Play'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.actionsRow}>
        <Pressable
          accessibilityRole="button"
          disabled={is_busy}
          onPress={handle_split}
          style={({ pressed }) => [
            styles.actionButton,
            {
              backgroundColor: with_color_opacity(theme.colors.accent, theme.is_dark ? 0.2 : 0.12),
              borderColor: theme.colors.line,
              opacity: is_busy ? 0.6 : 1,
            },
            pressed ? styles.pressed : null,
          ]}
        >
          <Text style={[styles.primaryActionText, { color: theme.colors.accent_strong }]}>
            {is_busy ? 'Splitting...' : 'Split here'}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          disabled={is_busy}
          onPress={confirm_delete_segment}
          style={({ pressed }) => [
            styles.actionButton,
            {
              backgroundColor: theme.colors.glass,
              borderColor: theme.colors.line,
              opacity: is_busy ? 0.6 : 1,
            },
            pressed ? styles.pressed : null,
          ]}
        >
          <Text style={[styles.secondaryActionText, { color: theme.colors.ink_soft }]}>
            Delete segment
          </Text>
        </Pressable>
      </View>
      </ScrollView>

      <DeleteEpisodeModal
        episode_title={episode.title}
        has_published_post={episode.is_published()}
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
  actionButton: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  content: {
    gap: 18,
    paddingBottom: 36,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  primaryActionText: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 19,
  },
  secondaryActionText: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 19,
  },
  heading: {
    fontSize: 24,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
    lineHeight: 29,
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
  pressed: {
    opacity: 0.72,
  },
  screen: {
    flex: 1,
  },
  secondaryButton: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 20,
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
});

export default observer(SplitScreen);
