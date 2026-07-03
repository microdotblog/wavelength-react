import React from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { WAVELENGTH_GOLD, with_color_opacity } from '../../theme/wavelengthTheme';

function get_background_layers(theme) {
  if (theme.is_dark) {
    return {
      base: ['#15100b', '#1c140c', '#24180f'],
      tint: [
        'rgba(21, 16, 11, 0.05)',
        with_color_opacity(theme.colors.accent, 0.1),
        with_color_opacity(theme.colors.accent, 0.16),
      ],
      glow: [
        with_color_opacity(theme.colors.accent, 0.08),
        with_color_opacity(WAVELENGTH_GOLD, 0.06),
        'rgba(0, 0, 0, 0)',
      ],
      edge: [
        'rgba(255, 255, 255, 0.04)',
        'rgba(255, 255, 255, 0.01)',
        with_color_opacity(theme.colors.accent, 0.1),
      ],
    };
  }

  return {
    base: ['#fffaf0', '#fff5e0', '#ffefd0'],
    tint: [
      'rgba(255, 255, 255, 0.05)',
      with_color_opacity(WAVELENGTH_GOLD, 0.14),
      with_color_opacity(theme.colors.accent, 0.18),
    ],
    glow: [
      'rgba(255, 244, 210, 0.55)',
      with_color_opacity(WAVELENGTH_GOLD, 0.12),
      'rgba(255, 250, 240, 0)',
    ],
    edge: [
      'rgba(255, 255, 255, 0.08)',
      'rgba(255, 255, 255, 0.02)',
      with_color_opacity(theme.colors.accent, 0.1),
    ],
  };
}

export default function AuthBackground({ theme }) {
  const glow_shift = useSharedValue(0);
  const background = get_background_layers(theme);

  React.useEffect(() => {
    glow_shift.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: 16000,
          easing: Easing.inOut(Easing.sin),
        }),
        withTiming(0, {
          duration: 16000,
          easing: Easing.inOut(Easing.sin),
        }),
      ),
      -1,
      false,
    );
  }, [glow_shift]);

  const tint_style = useAnimatedStyle(() => {
    return {
      opacity: 0.84 - glow_shift.value * 0.08,
      transform: [
        { translateX: -10 + glow_shift.value * 20 },
        { translateY: -12 + glow_shift.value * 18 },
        { scale: 1.02 + glow_shift.value * 0.03 },
      ],
    };
  }, []);

  const glow_style = useAnimatedStyle(() => {
    return {
      opacity: 0.66 + glow_shift.value * 0.14,
      transform: [
        { translateX: 12 - glow_shift.value * 28 },
        { translateY: -18 + glow_shift.value * 30 },
        { scale: 1.04 + glow_shift.value * 0.05 },
      ],
    };
  }, []);

  return (
    <Animated.View pointerEvents="none" style={styles.container}>
      <LinearGradient
        colors={background.base}
        end={{ x: 0.5, y: 1 }}
        start={{ x: 0.5, y: 0 }}
        style={styles.canvas}
      />

      <Animated.View style={[styles.canvas, tint_style]}>
        <LinearGradient
          colors={background.tint}
          end={{ x: 0.6, y: 1 }}
          start={{ x: 0.4, y: 0 }}
          style={styles.canvas}
        />
      </Animated.View>

      <Animated.View style={[styles.glow_layer, glow_style]}>
        <LinearGradient
          colors={background.glow}
          end={{ x: 0.5, y: 1 }}
          start={{ x: 0.5, y: 0 }}
          style={styles.canvas}
        />
      </Animated.View>

      <LinearGradient
        colors={background.edge}
        end={{ x: 0.5, y: 1 }}
        start={{ x: 0.5, y: 0 }}
        style={styles.canvas}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    ...StyleSheet.absoluteFillObject,
  },
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  glow_layer: {
    ...StyleSheet.absoluteFillObject,
  },
});