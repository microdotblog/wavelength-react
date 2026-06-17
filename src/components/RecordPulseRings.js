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
const LEVEL_SMOOTHING_MS = 90;
// How much further a ring pushes out at full volume, as a scale multiplier.
const MAX_EXTRA = 0.8;
const RING_MAX_OPACITY = 0.55;
// A steady level used to make the rings radiate when drawing attention.
const ATTENTION_LEVEL = 0.7;
// Fallback cadence used when no breath duration is supplied for attention mode.
const DEFAULT_ATTENTION_CADENCE_MS = 1800;
// Recording reacts quickly; attention rings swell gently like a breath.
const RECORDING_EASING = Easing.out(Easing.quad);
const ATTENTION_EASING = Easing.inOut(Easing.quad);

function PulseRing({ delay, duration, easing, is_active, level, theme }) {
  const progress = useSharedValue(0);

  React.useEffect(() => {
    if (is_active) {
      progress.value = withDelay(
        delay,
        withRepeat(
          withTiming(1, { duration, easing }),
          -1,
          false,
        ),
      );
    } else {
      cancelAnimation(progress);
      progress.value = withTiming(0, { duration: 180 });
    }

    return () => cancelAnimation(progress);
  }, [delay, duration, easing, is_active, progress]);

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

function RecordPulseRings({
  attention = false,
  attention_cadence_ms = DEFAULT_ATTENTION_CADENCE_MS,
  is_recording = false,
  metering,
  theme,
}) {
  const level = useSharedValue(0);
  const is_active = is_recording || attention;
  const is_attention_only = attention && !is_recording;
  // Emit one ring per breath so the radiate reads as calm and in step with the
  // breathing button, instead of the quick reactive pulse used while recording.
  const ring_duration = is_attention_only
    ? attention_cadence_ms * RING_COUNT
    : RING_DURATION_MS;
  const ring_stagger = ring_duration / RING_COUNT;
  const ring_easing = is_attention_only ? ATTENTION_EASING : RECORDING_EASING;

  React.useEffect(() => {
    let next_level = 0;

    if (is_recording && Number.isFinite(metering)) {
      next_level = normalize_metering(metering);
    } else if (attention) {
      next_level = ATTENTION_LEVEL;
    }

    level.value = withTiming(next_level, { duration: LEVEL_SMOOTHING_MS });
  }, [attention, is_recording, level, metering]);

  return (
    <>
      {Array.from({ length: RING_COUNT }).map((_unused, index) => (
        <PulseRing
          key={index}
          delay={index * ring_stagger}
          duration={ring_duration}
          easing={ring_easing}
          is_active={is_active}
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
