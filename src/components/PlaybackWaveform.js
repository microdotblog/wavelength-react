import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { upsample_waveform_levels, WAVEFORM_SAMPLE_COUNT } from '../lib/downsample_waveform';
import { with_color_opacity } from '../theme/wavelengthTheme';

const BAR_AREA_HEIGHT = 64;
const BAR_WIDTH = 2;
const BAR_GAP = 1;
const MIN_BAR_HEIGHT = 4;
const FALLBACK_LEVEL = 0.16;

function bar_count_for_width(width) {
  if (width <= 0) {
    return WAVEFORM_SAMPLE_COUNT;
  }

  return Math.max(WAVEFORM_SAMPLE_COUNT, Math.floor((width + BAR_GAP) / (BAR_WIDTH + BAR_GAP)));
}

function build_display_levels(waveform) {
  if (Array.isArray(waveform) && waveform.length > 0) {
    return waveform.map(level => Math.min(Math.max(level, 0), 1));
  }

  return new Array(WAVEFORM_SAMPLE_COUNT).fill(FALLBACK_LEVEL);
}

function BarsLayer({ bar_area_height, color, levels, width }) {
  return (
    <View style={[styles.bars, { height: bar_area_height }, width != null ? { width } : null]}>
      {levels.map((level, index) => (
        <View
          key={index}
          style={[
            styles.bar,
            { backgroundColor: color, height: Math.max(MIN_BAR_HEIGHT, level * bar_area_height) },
          ]}
        />
      ))}
    </View>
  );
}

function PlaybackWaveform({
  bar_area_height = BAR_AREA_HEIGHT,
  current_time = 0,
  duration_seconds = 0,
  is_playing = false,
  onSeek,
  theme,
  waveform = [],
}) {
  const [track_width, set_track_width] = React.useState(0);
  const width_ref = React.useRef(0);
  const on_seek_ref = React.useRef(onSeek);
  const is_scrubbing_ref = React.useRef(false);
  const progress = useSharedValue(0);
  const last_synced_fraction_ref = React.useRef(0);
  const levels = React.useMemo(() => {
    const base_levels = build_display_levels(waveform);
    return upsample_waveform_levels(base_levels, bar_count_for_width(track_width));
  }, [track_width, waveform]);

  on_seek_ref.current = onSeek;

  const played_color = theme.colors.accent;
  const muted_color = with_color_opacity(theme.colors.ink_soft, theme.is_dark ? 0.45 : 0.3);

  // Re-sync the animated playhead to the real playback time on every status
  // tick, then let it glide linearly toward the end so it never looks stepped.
  React.useEffect(() => {
    if (is_scrubbing_ref.current) {
      return;
    }

    const fraction = duration_seconds > 0
      ? Math.min(Math.max(current_time / duration_seconds, 0), 1)
      : 0;
    const remaining_ms = Math.max((duration_seconds - current_time) * 1000, 0);
    const jumped_backward = fraction + 0.02 < last_synced_fraction_ref.current;

    cancelAnimation(progress);
    progress.value = fraction;
    last_synced_fraction_ref.current = fraction;

    if (is_playing && duration_seconds > 0 && fraction < 1 && remaining_ms > 100 && !jumped_backward) {
      progress.value = withTiming(1, { duration: remaining_ms, easing: Easing.linear });
    }
  }, [current_time, duration_seconds, is_playing, progress]);

  function handle_layout(event) {
    const next_width = event.nativeEvent.layout.width;
    width_ref.current = next_width;
    set_track_width(next_width);
  }

  const scrub_to_x = React.useCallback(touch_x => {
    const width = width_ref.current;

    if (width <= 0) {
      return;
    }

    const fraction = Math.min(Math.max(touch_x / width, 0), 1);
    progress.value = fraction;

    const current_on_seek = on_seek_ref.current;

    if (typeof current_on_seek === 'function') {
      current_on_seek(fraction);
    }
  }, [progress]);

  // Gesture-handler keeps the horizontal scrub from being stolen by the native
  // stack's swipe-to-go-back gesture, while letting vertical scrolls pass through.
  const scrub_gesture = React.useMemo(() => {
    const tap = Gesture.Tap()
      .runOnJS(true)
      .onEnd(event => scrub_to_x(event.x));

    const pan = Gesture.Pan()
      .runOnJS(true)
      .activeOffsetX([-6, 6])
      .failOffsetY([-12, 12])
      .shouldCancelWhenOutside(false)
      .onStart(event => {
        is_scrubbing_ref.current = true;
        cancelAnimation(progress);
        scrub_to_x(event.x);
      })
      .onUpdate(event => scrub_to_x(event.x))
      .onFinalize(() => {
        is_scrubbing_ref.current = false;
      });

    return Gesture.Race(tap, pan);
  }, [progress, scrub_to_x]);

  const reveal_style = useAnimatedStyle(() => ({
    width: progress.value * track_width,
  }));

  const playhead_style = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * track_width }],
  }));

  return (
    <GestureDetector gesture={scrub_gesture}>
      <View
        accessibilityRole="adjustable"
        onLayout={handle_layout}
        style={[styles.container, { height: bar_area_height }]}
      >
        <BarsLayer bar_area_height={bar_area_height} color={muted_color} levels={levels} />

        <Animated.View pointerEvents="none" style={[styles.reveal, reveal_style]}>
          <BarsLayer
            bar_area_height={bar_area_height}
            color={played_color}
            levels={levels}
            width={track_width}
          />
        </Animated.View>

        <Animated.View
          pointerEvents="none"
          style={[styles.playhead, { backgroundColor: theme.colors.accent_strong }, playhead_style]}
        />
      </View>
    </GestureDetector>
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
    width: '100%',
  },
  container: {
    justifyContent: 'center',
    overflow: 'hidden',
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
  reveal: {
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    top: 0,
  },
});

export default PlaybackWaveform;