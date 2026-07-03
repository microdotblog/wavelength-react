import React from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { observer } from 'mobx-react';

import PlatformSymbol from './PlatformSymbol';
import PlaybackProgressBar from './PlaybackProgressBar';
import { format_duration } from '../lib/format_duration';
import { resolve_playback_toggle_action } from '../lib/publish_editor';
import { with_color_opacity } from '../theme/wavelengthTheme';

const TOOLBAR_PLAY_BUTTON_SIZE = 40;

function CompactPlaybackButton({ is_buffering = false, is_playing = false, onPress, theme }) {
  if (is_buffering) {
    return (
      <View
        accessibilityLabel="Buffering audio"
        style={[
          styles.playButton,
          {
            backgroundColor: with_color_opacity(theme.colors.accent, theme.is_dark ? 0.18 : 0.12),
            borderColor: with_color_opacity(theme.colors.accent, theme.is_dark ? 0.5 : 0.35),
          },
        ]}
      >
        <ActivityIndicator color={theme.colors.accent} size="small" />
      </View>
    );
  }

  return (
    <Pressable
      accessibilityLabel={is_playing ? 'Pause discover playback' : 'Play discover playback'}
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
      <PlatformSymbol
        color={theme.colors.button_text}
        name={is_playing ? 'pause' : 'play'}
        size={14}
      />
    </Pressable>
  );
}

function DiscoverPlaybackToolbar({
  author_name = '',
  current_time = 0,
  duration_seconds = 0,
  is_buffering = false,
  is_playing = false,
  on_close,
  on_open_post,
  on_seek,
  on_toggle_playback,
  post_title = '',
  theme,
}) {
  function handle_toggle_playback() {
    if (is_buffering) {
      return;
    }

    const action = resolve_playback_toggle_action(is_playing);
    on_toggle_playback?.(action);
  }

  const display_title = `${post_title || author_name || 'Discover microcast'}`.trim();
  const progress_time_label = is_buffering
    ? 'Buffering…'
    : `${format_duration(current_time)} / ${format_duration(duration_seconds)}`;

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
        <Pressable
          accessibilityHint={on_open_post ? 'Opens the linked microcast post' : undefined}
          accessibilityLabel={on_open_post ? `Open ${display_title}` : undefined}
          accessibilityRole={on_open_post ? 'button' : undefined}
          disabled={!on_open_post}
          onPress={on_open_post}
          style={({ pressed }) => [
            styles.titleWrap,
            on_open_post && pressed ? styles.pressed : null,
          ]}
        >
          <View style={styles.attachmentLabelRow}>
            <PlatformSymbol
              color={theme.colors.accent}
              name="waveform"
              size={14}
            />
            <Text style={[styles.attachmentLabel, { color: theme.colors.ink_soft }]}>
              Now playing
            </Text>
          </View>
          <Text
            numberOfLines={1}
            style={[styles.postTitle, { color: theme.colors.ink }]}
          >
            {display_title}
          </Text>
        </Pressable>
        {on_close ? (
          <Pressable
            accessibilityLabel="Close discover playback"
            accessibilityRole="button"
            hitSlop={8}
            onPress={on_close}
            style={({ pressed }) => [styles.closeButton, pressed ? styles.pressed : null]}
          >
            <PlatformSymbol
              color={theme.colors.ink_soft}
              name="xmark"
              size={12}
            />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.controlsRow}>
        <CompactPlaybackButton
          is_buffering={is_buffering}
          is_playing={is_playing}
          onPress={handle_toggle_playback}
          theme={theme}
        />
        <View
          style={[
            styles.progressColumn,
            is_buffering
              ? {
                  backgroundColor: with_color_opacity(theme.colors.accent, theme.is_dark ? 0.08 : 0.05),
                }
              : null,
          ]}
        >
          <PlaybackProgressBar
            current_time={current_time}
            duration_seconds={duration_seconds}
            is_playing={is_playing && !is_buffering}
            onSeek={on_seek}
            theme={theme}
          />
          <Text style={[styles.progressTimeLabel, { color: theme.colors.ink_soft }]}>
            {progress_time_label}
          </Text>
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
  attachmentLabelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  closeButton: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 12,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  container: {
    borderCurve: 'continuous',
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  controlsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  progressColumn: {
    borderCurve: 'continuous',
    borderRadius: 14,
    flex: 1,
    gap: 6,
    justifyContent: 'center',
    minHeight: TOOLBAR_PLAY_BUTTON_SIZE,
    overflow: 'visible',
    paddingHorizontal: 2,
    paddingVertical: 4,
  },
  progressTimeLabel: {
    alignSelf: 'flex-end',
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
    lineHeight: 14,
  },
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
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
  postTitle: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
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
  titleWrap: {
    flex: 1,
    gap: 2,
  },
});

export default observer(DiscoverPlaybackToolbar);