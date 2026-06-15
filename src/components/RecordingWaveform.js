import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { WAVELENGTH_GOLD, with_color_opacity } from '../theme/wavelengthTheme';

const BAR_AREA_HEIGHT = 88;
const MIN_BAR_HEIGHT = 4;
const PEAK_LEVEL = 0.7;
const SPRING_CONFIG = {
  damping: 16,
  mass: 0.4,
  stiffness: 220,
};

function level_to_height(level) {
  const clamped_level = Math.min(Math.max(level, 0), 1);

  return Math.max(MIN_BAR_HEIGHT, clamped_level * BAR_AREA_HEIGHT);
}

function level_to_color(level, theme) {
  const clamped_level = Math.min(Math.max(level, 0), 1);
  const is_peak = clamped_level >= PEAK_LEVEL;
  const bar_color = is_peak ? WAVELENGTH_GOLD : theme.colors.accent;
  const bar_opacity = 0.35 + clamped_level * 0.65;

  return with_color_opacity(bar_color, bar_opacity);
}

function WaveformBar({ color, level }) {
  const height = useSharedValue(level_to_height(level));

  React.useEffect(() => {
    height.value = withSpring(level_to_height(level), SPRING_CONFIG);
  }, [height, level]);

  const animated_style = useAnimatedStyle(() => ({
    height: height.value,
  }));

  return <Animated.View style={[styles.bar, { backgroundColor: color }, animated_style]} />;
}

function RecordingWaveform({ is_recording = false, levels = [], theme }) {
  return (
    <View
      accessibilityLabel={is_recording ? 'Recording level' : 'Ready to record'}
      accessibilityRole="image"
      style={styles.panel}
    >
      <View style={styles.bars}>
        {levels.map((level, index) => (
          <WaveformBar key={index} color={level_to_color(level, theme)} level={level} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderRadius: 3,
    flex: 1,
    maxWidth: 7,
  },
  bars: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    height: BAR_AREA_HEIGHT,
    justifyContent: 'center',
    width: '100%',
  },
  panel: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
    width: '100%',
  },
});

export default RecordingWaveform;
