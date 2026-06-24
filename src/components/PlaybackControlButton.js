import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { with_color_opacity } from '../theme/wavelengthTheme';

const BUTTON_SIZE = 56;
const RING_BREATHE_MS = 900;
const RING_BREATHE_SCALE = 1.12;

function PlaybackControlButton({ is_playing = false, onPress, theme }) {
  const ring_scale = useSharedValue(1);

  React.useEffect(() => {
    if (is_playing) {
      ring_scale.value = withRepeat(
        withSequence(
          withTiming(RING_BREATHE_SCALE, {
            duration: RING_BREATHE_MS,
            easing: Easing.inOut(Easing.quad),
          }),
          withTiming(1, {
            duration: RING_BREATHE_MS,
            easing: Easing.inOut(Easing.quad),
          }),
        ),
        -1,
        false,
      );
      return () => cancelAnimation(ring_scale);
    }

    cancelAnimation(ring_scale);
    ring_scale.value = withTiming(1, { duration: 200 });
    return () => cancelAnimation(ring_scale);
  }, [is_playing, ring_scale]);

  const ring_style = useAnimatedStyle(() => ({
    transform: [{ scale: ring_scale.value }],
  }));

  return (
    <View style={styles.wrap}>
      {is_playing ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            ring_style,
            { backgroundColor: with_color_opacity(theme.colors.accent, theme.is_dark ? 0.24 : 0.16) },
          ]}
        />
      ) : null}

      <Pressable
        accessibilityLabel={is_playing ? 'Pause' : 'Play'}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: theme.colors.accent,
            borderColor: with_color_opacity(theme.colors.accent, theme.is_dark ? 0.5 : 0.35),
          },
          pressed ? styles.pressed : null,
        ]}
      >
        {is_playing ? (
          <View style={styles.pauseIcon}>
            <View style={[styles.pauseBar, { backgroundColor: theme.colors.button_text }]} />
            <View style={[styles.pauseBar, { backgroundColor: theme.colors.button_text }]} />
          </View>
        ) : (
          <Text style={[styles.playGlyph, { color: theme.colors.button_text }]}>▶</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: BUTTON_SIZE / 2,
    borderWidth: 2,
    height: BUTTON_SIZE,
    justifyContent: 'center',
    width: BUTTON_SIZE,
  },
  pauseBar: {
    borderRadius: 2,
    height: 18,
    width: 5,
  },
  pauseIcon: {
    flexDirection: 'row',
    gap: 5,
  },
  playGlyph: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 18,
    marginLeft: 2,
  },
  pressed: {
    opacity: 0.72,
  },
  ring: {
    borderRadius: (BUTTON_SIZE + 18) / 2,
    height: BUTTON_SIZE + 18,
    left: -9,
    position: 'absolute',
    top: -9,
    width: BUTTON_SIZE + 18,
  },
  wrap: {
    height: BUTTON_SIZE,
    width: BUTTON_SIZE,
  },
});

export default PlaybackControlButton;
