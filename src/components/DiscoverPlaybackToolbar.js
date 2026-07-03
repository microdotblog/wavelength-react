import React from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { observer } from 'mobx-react';

import { DiscoverSourceAvatar } from './DiscoverPostRow';
import PlatformSymbol from './PlatformSymbol';
import PlaybackProgressBar from './PlaybackProgressBar';
import { format_duration } from '../lib/format_duration';
import { resolve_playback_toggle_action } from '../lib/publish_editor';
import { with_color_opacity } from '../theme/wavelengthTheme';

const PLAYBACK_ARTWORK_SIZE = 26;
const PLAYBACK_ICON_SIZE = Platform.select({ android: 24, default: 20 });
const PLAYBACK_CONTROL_SIZE = 28;
const PLAYBACK_PROGRESS_BAR_HEIGHT = 28;

function CompactPlaybackButton({ is_buffering = false, is_playing = false, onPress, theme }) {
  if (is_buffering) {
    return (
      <View
        accessibilityLabel="Buffering audio"
        style={styles.playbackControl}
      >
        <ActivityIndicator color={theme.colors.accent} size="small" />
      </View>
    );
  }

  return (
    <Pressable
      accessibilityLabel={is_playing ? 'Pause discover playback' : 'Play discover playback'}
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.playbackControl,
        pressed ? styles.pressed : null,
      ]}
    >
      <PlatformSymbol
        color={theme.colors.accent}
        name={is_playing ? 'pause' : 'play'}
        size={PLAYBACK_ICON_SIZE}
      />
    </Pressable>
  );
}

function DiscoverPlaybackToolbar({
  artwork_url = '',
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
  const artwork_source_label = author_name || display_title;
  const should_show_artwork = Boolean(`${artwork_url || ''}`.trim() || artwork_source_label);
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
          {should_show_artwork ? (
            <DiscoverSourceAvatar
              avatar_url={artwork_url}
              size={PLAYBACK_ARTWORK_SIZE}
              source={artwork_source_label}
              theme={theme}
            />
          ) : null}
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
        <View style={styles.progressCluster}>
          <View
            style={[
              styles.progressBarSlot,
              is_buffering
                ? {
                    backgroundColor: with_color_opacity(theme.colors.accent, theme.is_dark ? 0.08 : 0.05),
                  }
                : null,
            ]}
          >
            <PlaybackProgressBar
              bar_area_height={PLAYBACK_PROGRESS_BAR_HEIGHT}
              current_time={current_time}
              duration_seconds={duration_seconds}
              is_playing={is_playing && !is_buffering}
              onSeek={on_seek}
              theme={theme}
            />
          </View>
          <Text
            numberOfLines={1}
            pointerEvents="none"
            style={[styles.progressTimeLabel, { color: theme.colors.ink_soft }]}
          >
            {progress_time_label}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  controlsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    minHeight: PLAYBACK_CONTROL_SIZE,
  },
  progressCluster: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    minWidth: 0,
  },
  playbackControl: {
    alignItems: 'center',
    height: PLAYBACK_CONTROL_SIZE,
    justifyContent: 'center',
    width: PLAYBACK_CONTROL_SIZE,
  },
  progressBarSlot: {
    borderCurve: 'continuous',
    borderRadius: 12,
    flex: 1,
    justifyContent: 'center',
    minHeight: PLAYBACK_PROGRESS_BAR_HEIGHT,
    minWidth: 0,
    overflow: 'visible',
    paddingHorizontal: 2,
  },
  progressTimeLabel: {
    flexShrink: 0,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
    lineHeight: 14,
    maxWidth: 96,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    minHeight: PLAYBACK_ARTWORK_SIZE,
  },
  postTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
    minWidth: 0,
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
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    minWidth: 0,
  },
});

export default observer(DiscoverPlaybackToolbar);