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
const PLAYBACK_ICON_SIZE = Platform.select({ android: 22, default: 16 });
const PLAYBACK_CONTROL_SIZE = 32;
const PLAYBACK_PROGRESS_BAR_HEIGHT = 28;

function playback_dock_surface(theme) {
  if (theme.is_dark) {
    return {
      backgroundColor: theme.colors.paper_alt,
      borderColor: with_color_opacity(theme.colors.accent, 0.55),
    };
  }

  return {
    backgroundColor: with_color_opacity(theme.colors.paper, 0.96),
    borderColor: theme.colors.line,
  };
}

function playback_dock_shadow(theme) {
  if (Platform.OS === 'android') {
    return {
      elevation: theme.is_dark ? 6 : 3,
    };
  }

  return {
    shadowColor: theme.is_dark ? '#000000' : '#24180d',
    shadowOffset: { height: theme.is_dark ? 6 : 4, width: 0 },
    shadowOpacity: theme.is_dark ? 0.42 : 0.12,
    shadowRadius: theme.is_dark ? 18 : 14,
  };
}

function CompactPlaybackButton({ is_buffering = false, is_playing = false, onPress, theme }) {
  const control_surface = {
    backgroundColor: is_buffering
      ? with_color_opacity(theme.colors.accent, theme.is_dark ? 0.18 : 0.12)
      : theme.colors.accent,
    borderColor: with_color_opacity(theme.colors.accent, theme.is_dark ? 0.5 : 0.35),
  };

  if (is_buffering) {
    return (
      <View
        accessibilityLabel="Buffering audio"
        style={[styles.playbackControl, control_surface]}
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
        control_surface,
        pressed ? styles.pressed : null,
      ]}
    >
      <PlatformSymbol
        color={theme.colors.button_text}
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

  const dock_surface = playback_dock_surface(theme);

  return (
    <View
      style={[
        styles.container,
        playback_dock_shadow(theme),
        dock_surface,
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
            style={({ pressed }) => [
              styles.closeButton,
              {
                backgroundColor: with_color_opacity(
                  theme.colors.ink_soft,
                  theme.is_dark ? 0.14 : 0.1,
                ),
              },
              pressed ? styles.pressed : null,
            ]}
          >
            <PlatformSymbol
              color={theme.colors.ink_soft}
              name="xmark"
              size={13}
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
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
    borderCurve: 'continuous',
    borderRadius: PLAYBACK_CONTROL_SIZE / 2,
    borderWidth: 2,
    flexShrink: 0,
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
  titleWrap: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    minWidth: 0,
  },
});

export default observer(DiscoverPlaybackToolbar);