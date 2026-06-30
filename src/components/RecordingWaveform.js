import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { upsample_waveform_levels } from '../lib/downsample_waveform';
import { BAR_COUNT, IDLE_LEVEL } from '../hooks/use_recording_waveform_levels';
import { WAVELENGTH_GOLD, with_color_opacity } from '../theme/wavelengthTheme';

const BAR_AREA_HEIGHT = 88;
const BAR_WIDTH = 2;
const BAR_GAP = 1;
const MIN_BAR_HEIGHT = 4;
const PEAK_LEVEL = 0.7;
const EDGE_FADE_FRACTION = 0.14;
const IDLE_WAVE_DURATION_MS = 4000;
const IDLE_WAVE_AMPLITUDE = 0.035;
const IDLE_TRAVEL_WEIGHT = 0.65;
const IDLE_BREATHE_WEIGHT = 0.35;
const SPRING_CONFIG = {
  damping: 16,
  mass: 0.4,
  stiffness: 220,
};

function bar_count_for_width(width) {
  if (width <= 0) {
    return BAR_COUNT;
  }

  return Math.max(BAR_COUNT, Math.floor((width + BAR_GAP) / (BAR_WIDTH + BAR_GAP)));
}

function edge_fade(index, total) {
  const fade_count = Math.max(4, Math.round(total * EDGE_FADE_FRACTION));

  if (index < fade_count) {
    return (index + 1) / (fade_count + 1);
  }

  if (index >= total - fade_count) {
    return (total - index) / (fade_count + 1);
  }

  return 1;
}

function level_to_height(level) {
  'worklet';

  const clamped_level = Math.min(Math.max(level, 0), 1);

  return Math.max(MIN_BAR_HEIGHT, clamped_level * BAR_AREA_HEIGHT);
}

function level_to_color(level, theme, edge_opacity = 1) {
  const clamped_level = Math.min(Math.max(level, 0), 1);
  const is_peak = clamped_level >= PEAK_LEVEL;
  const bar_color = is_peak ? WAVELENGTH_GOLD : theme.colors.accent;
  const bar_opacity = (0.35 + clamped_level * 0.65) * edge_opacity;

  return with_color_opacity(bar_color, bar_opacity);
}

function idle_wave_level(progress, phase) {
  'worklet';

  // Smooth 0→1→0 sweep: ripple travels right, then back left.
  const sweep = 0.5 - 0.5 * Math.cos(progress * Math.PI * 2);
  const travel = Math.sin((sweep + phase) * Math.PI * 2);
  // Whole-line inhale/exhale keeps the motion from feeling one-directional.
  const breathe = Math.cos(progress * Math.PI * 2);
  const wave = travel * IDLE_TRAVEL_WEIGHT + breathe * IDLE_BREATHE_WEIGHT;

  return IDLE_LEVEL + wave * IDLE_WAVE_AMPLITUDE;
}

function WaveformBar({ animate_idle, color, idle_phase, level }) {
  const height = useSharedValue(level_to_height(level));
  const wave_progress = useSharedValue(0);

  React.useEffect(() => {
    if (animate_idle) {
      wave_progress.value = withRepeat(
        withTiming(1, {
          duration: IDLE_WAVE_DURATION_MS,
          easing: Easing.inOut(Easing.sin),
        }),
        -1,
        false,
      );

      return () => cancelAnimation(wave_progress);
    }

    cancelAnimation(wave_progress);
    wave_progress.value = 0;
  }, [animate_idle, wave_progress]);

  React.useEffect(() => {
    if (!animate_idle) {
      height.value = withSpring(level_to_height(level), SPRING_CONFIG);
    }
  }, [animate_idle, height, level]);

  const animated_style = useAnimatedStyle(() => {
    if (animate_idle) {
      return { height: level_to_height(idle_wave_level(wave_progress.value, idle_phase)) };
    }

    return { height: height.value };
  });

  return <Animated.View style={[styles.bar, { backgroundColor: color }, animated_style]} />;
}

function RecordingWaveform({ attention = false, is_recording = false, levels = [], theme }) {
  const [track_width, set_track_width] = React.useState(0);
  const display_levels = React.useMemo(
    () => upsample_waveform_levels(levels, bar_count_for_width(track_width)),
    [levels, track_width],
  );

  function handle_layout(event) {
    set_track_width(event.nativeEvent.layout.width);
  }

  const animate_idle = attention && !is_recording;
  const bar_count = display_levels.length;

  return (
    <View
      accessibilityLabel={is_recording ? 'Recording level' : 'Ready to record'}
      accessibilityRole="image"
      onLayout={handle_layout}
      style={styles.panel}
    >
      <View style={styles.bars}>
        {display_levels.map((level, index) => (
          <WaveformBar
            key={index}
            animate_idle={animate_idle}
            color={level_to_color(level, theme, edge_fade(index, bar_count))}
            idle_phase={bar_count > 0 ? index / bar_count : 0}
            level={level}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderRadius: 1,
    flex: 1,
    maxWidth: BAR_WIDTH,
  },
  bars: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: BAR_GAP,
    height: BAR_AREA_HEIGHT,
    width: '100%',
  },
  panel: {
    justifyContent: 'center',
    paddingVertical: 16,
    width: '100%',
  },
});

export default RecordingWaveform;
