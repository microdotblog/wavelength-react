import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { normalize_metering } from '../lib/normalize_metering';

const RING_SIZE = 140;
const RING_COUNT = 3;
const RING_DURATION_MS = 1600;
const RING_STAGGER_MS = RING_DURATION_MS / RING_COUNT;
const LEVEL_SMOOTHING_MS = 90;
// How much further a ring pushes out at full volume, as a scale multiplier.
const MAX_EXTRA = 0.8;
const RING_MAX_OPACITY = 0.55;

function PulseRing({ delay, is_recording, level, theme }) {
  const progress = useSharedValue(0);

  React.useEffect(() => {
    if (is_recording) {
      progress.value = withDelay(
        delay,
        withRepeat(
          withTiming(1, { duration: RING_DURATION_MS, easing: Easing.out(Easing.quad) }),
          -1,
          false,
        ),
      );
    } else {
      cancelAnimation(progress);
      progress.value = withTiming(0, { duration: 180 });
    }

    return () => cancelAnimation(progress);
  }, [delay, is_recording, progress]);

  const animated_style = useAnimatedStyle(() => {
    const reach = 1 + MAX_EXTRA * level.value;
    const scale = interpolate(progress.value, [0, 1], [1, reach]);
    const opacity = interpolate(progress.value, [0, 1], [RING_MAX_OPACITY * level.value, 0]);

    return {
      opacity,
      transform: [{ scale }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.ring, { borderColor: theme.colors.accent }, animated_style]}
    />
  );
}

function RecordPulseRings({ is_recording = false, metering, theme }) {
  const level = useSharedValue(0);

  React.useEffect(() => {
    const next_level = is_recording && Number.isFinite(metering)
      ? normalize_metering(metering)
      : 0;
    level.value = withTiming(next_level, { duration: LEVEL_SMOOTHING_MS });
  }, [is_recording, level, metering]);

  return (
    <>
      {Array.from({ length: RING_COUNT }).map((_unused, index) => (
        <PulseRing
          key={index}
          delay={index * RING_STAGGER_MS}
          is_recording={is_recording}
          level={level}
          theme={theme}
        />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  ring: {
    borderCurve: 'continuous',
    borderRadius: RING_SIZE / 2,
    borderWidth: 3,
    height: RING_SIZE,
    position: 'absolute',
    width: RING_SIZE,
  },
});

export default RecordPulseRings;
