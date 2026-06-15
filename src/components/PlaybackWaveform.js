import React from 'react';
import { StyleSheet, View } from 'react-native';

import { WAVEFORM_SAMPLE_COUNT } from '../lib/downsample_waveform';
import { with_color_opacity } from '../theme/wavelengthTheme';

const BAR_AREA_HEIGHT = 64;
const MIN_BAR_HEIGHT = 4;
const FALLBACK_LEVEL = 0.16;

function build_display_levels(waveform) {
  if (Array.isArray(waveform) && waveform.length > 0) {
    return waveform.map(level => Math.min(Math.max(level, 0), 1));
  }

  return new Array(WAVEFORM_SAMPLE_COUNT).fill(FALLBACK_LEVEL);
}

function PlaybackWaveform({ onSeek, progress = 0, theme, waveform = [] }) {
  const width_ref = React.useRef(0);
  const levels = build_display_levels(waveform);
  const clamped_progress = Math.min(Math.max(progress, 0), 1);

  function handle_layout(event) {
    width_ref.current = event.nativeEvent.layout.width;
  }

  function seek_to_touch(event) {
    const width = width_ref.current;

    if (typeof onSeek !== 'function' || width <= 0) {
      return;
    }

    const fraction = Math.min(Math.max(event.nativeEvent.locationX / width, 0), 1);
    onSeek(fraction);
  }

  return (
    <View
      accessibilityRole="adjustable"
      accessibilityValue={{ now: Math.round(clamped_progress * 100), min: 0, max: 100 }}
      hitSlop={12}
      onLayout={handle_layout}
      onResponderGrant={seek_to_touch}
      onResponderMove={seek_to_touch}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      style={styles.container}
    >
      <View style={styles.bars}>
        {levels.map((level, index) => {
          const bar_height = Math.max(MIN_BAR_HEIGHT, level * BAR_AREA_HEIGHT);
          const bar_center = (index + 0.5) / levels.length;
          const is_played = bar_center <= clamped_progress;
          const bar_color = is_played
            ? theme.colors.accent
            : with_color_opacity(theme.colors.ink_soft, theme.is_dark ? 0.45 : 0.3);

          return (
            <View
              key={index}
              style={[styles.bar, { backgroundColor: bar_color, height: bar_height }]}
            />
          );
        })}
      </View>

      <View
        pointerEvents="none"
        style={[
          styles.playhead,
          {
            backgroundColor: theme.colors.accent_strong,
            left: `${clamped_progress * 100}%`,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderRadius: 2,
    flex: 1,
  },
  bars: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
    height: BAR_AREA_HEIGHT,
    width: '100%',
  },
  container: {
    height: BAR_AREA_HEIGHT,
    justifyContent: 'center',
    width: '100%',
  },
  playhead: {
    borderRadius: 1,
    bottom: 0,
    marginLeft: -1,
    position: 'absolute',
    top: 0,
    width: 2,
  },
});

export default PlaybackWaveform;
