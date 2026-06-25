import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { observer } from 'mobx-react';

import PlaybackWaveform from './PlaybackWaveform';
import { format_duration } from '../lib/format_duration';
import { resolve_playback_toggle_action } from '../lib/publish_editor';
import { with_color_opacity } from '../theme/wavelengthTheme';

const TOOLBAR_PLAY_BUTTON_SIZE = 40;

function CompactPlaybackButton({ is_playing = false, onPress, theme }) {
  return (
    <Pressable
      accessibilityLabel={is_playing ? 'Pause episode preview' : 'Play episode preview'}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.playButton,
        {
          backgroundColor: theme.colors.accent,
          borderColor: with_color_opacity(theme.colors.accent, theme.is_dark ? 0.5 : 0.35),
        },
        pressed ? styles.pressed : null,
      ]}
    >
      {is_playing ? (
        <View style={styles.pauseIcon}>
          <View style={[styles.pauseBar, { backgroundColor: theme.colors.button_text }]} />
          <View style={[styles.pauseBar, { backgroundColor: theme.colors.button_text }]} />
        </View>
      ) : (
        <Text style={[styles.playGlyph, { color: theme.colors.button_text }]}>▶</Text>
      )}
    </Pressable>
  );
}

function EpisodeAttachmentToolbar({
  current_time = 0,
  duration_seconds = 0,
  episode_title = '',
  is_playing = false,
  on_toggle_playback,
  on_seek,
  theme,
  waveform = [],
}) {
  function handle_toggle_playback() {
    const action = resolve_playback_toggle_action(is_playing);
    on_toggle_playback?.(action);
  }

  return (
    <View
      style={[
        styles.container,
        styles.shadow,
        {
          backgroundColor: theme.is_dark ? 'rgba(55, 65, 81, 0.92)' : 'rgba(255, 255, 255, 0.9)',
          borderColor: theme.is_dark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(31, 41, 55, 0.12)',
        },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <Text style={[styles.attachmentLabel, { color: theme.colors.ink_soft }]}>
            Attached episode
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.episodeTitle, { color: theme.colors.ink }]}
          >
            {episode_title || 'Untitled episode'}
          </Text>
        </View>
        <Text style={[styles.timeLabel, { color: theme.colors.ink_soft }]}>
          {format_duration(current_time)} / {format_duration(duration_seconds)}
        </Text>
      </View>

      <View style={styles.controlsRow}>
        <CompactPlaybackButton
          is_playing={is_playing}
          onPress={handle_toggle_playback}
          theme={theme}
        />
        <View style={styles.waveformWrap}>
          <PlaybackWaveform
            bar_area_height={44}
            current_time={current_time}
            duration_seconds={duration_seconds}
            is_playing={is_playing}
            onSeek={on_seek}
            theme={theme}
            waveform={waveform}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  attachmentLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    lineHeight: 14,
    textTransform: 'uppercase',
  },
  container: {
    borderCurve: 'continuous',
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  controlsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  episodeTitle: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  pauseBar: {
    borderRadius: 2,
    height: 14,
    width: 4,
  },
  pauseIcon: {
    flexDirection: 'row',
    gap: 4,
  },
  playButton: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: TOOLBAR_PLAY_BUTTON_SIZE / 2,
    borderWidth: 2,
    height: TOOLBAR_PLAY_BUTTON_SIZE,
    justifyContent: 'center',
    width: TOOLBAR_PLAY_BUTTON_SIZE,
  },
  playGlyph: {
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 15,
    marginLeft: 2,
  },
  pressed: {
    opacity: 0.72,
  },
  shadow: Platform.select({
    android: {
      elevation: 3,
    },
    default: {},
    ios: {
      shadowColor: '#000',
      shadowOffset: { height: 4, width: 0 },
      shadowOpacity: 0.1,
      shadowRadius: 14,
    },
  }),
  timeLabel: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
    marginTop: 2,
  },
  titleWrap: {
    flex: 1,
    gap: 2,
  },
  waveformWrap: {
    flex: 1,
  },
});

export default observer(EpisodeAttachmentToolbar);