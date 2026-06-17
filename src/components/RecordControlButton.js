import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import RecordPulseRings from './RecordPulseRings';
import { with_color_opacity } from '../theme/wavelengthTheme';

const BREATHE_DURATION_MS = 900;
const BREATHE_SCALE = 1.06;
// The dot pulses on its own slightly slower clock so it feels independent.
const DOT_PULSE_DURATION_MS = 1100;
const DOT_PULSE_SCALE = 0.9;

function RecordDot({ color }) {
  const pulse = useSharedValue(1);

  React.useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(DOT_PULSE_SCALE, {
          duration: DOT_PULSE_DURATION_MS,
          easing: Easing.inOut(Easing.quad),
        }),
        withTiming(1, {
          duration: DOT_PULSE_DURATION_MS,
          easing: Easing.inOut(Easing.quad),
        }),
      ),
      -1,
      false,
    );

    return () => cancelAnimation(pulse);
  }, [pulse]);

  const pulse_style = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return <Animated.View style={[styles.recordDot, { backgroundColor: color }, pulse_style]} />;
}

function render_record_icon(recording_phase, color) {
  if (recording_phase === 'recording') {
    return (
      <View style={styles.pauseIcon}>
        <View style={[styles.pauseBar, { backgroundColor: color }]} />
        <View style={[styles.pauseBar, { backgroundColor: color }]} />
      </View>
    );
  }

  return <RecordDot color={color} />;
}

function resolve_record_button_label(recording_phase) {
  if (recording_phase === 'recording') {
    return 'Pause recording';
  }

  if (recording_phase === 'paused') {
    return 'Resume recording';
  }

  return 'Start recording';
}

function RecordControlButton({
  attention = false,
  disabled = false,
  metering,
  onPress,
  recording_phase = 'idle',
  theme,
}) {
  const is_recording = recording_phase === 'recording';
  const record_button_label = resolve_record_button_label(recording_phase);
  const is_breathing = attention && recording_phase === 'idle';
  const breathe = useSharedValue(1);

  React.useEffect(() => {
    if (is_breathing) {
      breathe.value = withRepeat(
        withSequence(
          withTiming(BREATHE_SCALE, {
            duration: BREATHE_DURATION_MS,
            easing: Easing.inOut(Easing.quad),
          }),
          withTiming(1, {
            duration: BREATHE_DURATION_MS,
            easing: Easing.inOut(Easing.quad),
          }),
        ),
        -1,
        false,
      );
    } else {
      cancelAnimation(breathe);
      breathe.value = withTiming(1, { duration: 200 });
    }

    return () => cancelAnimation(breathe);
  }, [breathe, is_breathing]);

  const breathe_style = useAnimatedStyle(() => ({
    transform: [{ scale: breathe.value }],
  }));

  return (
    <View style={styles.recordButtonWrap}>
      <RecordPulseRings
        attention={attention}
        attention_cadence_ms={BREATHE_DURATION_MS * 2}
        is_recording={is_recording}
        metering={metering}
        theme={theme}
      />

      <Animated.View style={breathe_style}>
        <Pressable
          accessibilityLabel={record_button_label}
          accessibilityRole="button"
          disabled={disabled}
          onPress={onPress}
          style={({ pressed }) => [
            styles.recordButton,
            {
              backgroundColor: with_color_opacity(theme.colors.accent, theme.is_dark ? 0.18 : 0.12),
              borderColor: theme.colors.accent,
              opacity: disabled ? 0.5 : 1,
            },
            pressed && !disabled ? styles.pressed : null,
          ]}
        >
          {render_record_icon(recording_phase, theme.colors.accent)}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  pauseBar: {
    borderRadius: 4,
    height: 52,
    width: 16,
  },
  pauseIcon: {
    flexDirection: 'row',
    gap: 10,
  },
  pressed: {
    opacity: 0.72,
  },
  recordButton: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 70,
    borderWidth: 2,
    height: 140,
    justifyContent: 'center',
    width: 140,
  },
  recordButtonWrap: {
    alignItems: 'center',
    height: 140,
    justifyContent: 'center',
    width: 140,
  },
  recordDot: {
    borderRadius: 32,
    height: 64,
    width: 64,
  },
});

export default RecordControlButton;
