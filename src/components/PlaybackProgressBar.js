import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { format_duration } from '../lib/format_duration';
import { with_color_opacity } from '../theme/wavelengthTheme';

const BAR_AREA_HEIGHT = 36;
const TRACK_HEIGHT = 4;
const SCRUB_HOLD_SCALE_X = 1.02;
const SCRUB_HOLD_SCALE_Y = 1.9;
const SCRUB_HOLD_MIN_DURATION_MS = 180;
const SCRUB_SPRING = {
  damping: 20,
  stiffness: 280,
};

function PlaybackProgressBar({
  bar_area_height = BAR_AREA_HEIGHT,
  current_time = 0,
  duration_seconds = 0,
  is_playing = false,
  onSeek,
  theme,
}) {
  const [track_width, set_track_width] = React.useState(0);
  const width_ref = React.useRef(0);
  const on_seek_ref = React.useRef(onSeek);
  const is_scrubbing_ref = React.useRef(false);
  const is_holding_ref = React.useRef(false);
  const progress = useSharedValue(0);
  const scrub_scale_x = useSharedValue(1);
  const scrub_scale_y = useSharedValue(1);
  const last_synced_fraction_ref = React.useRef(0);

  on_seek_ref.current = onSeek;

  const track_color = with_color_opacity(
    theme.colors.ink_soft,
    theme.is_dark ? 0.34 : 0.22,
  );
  const fill_color = theme.colors.accent;

  function set_scrub_active(active = false) {
    if (active) {
      scrub_scale_x.value = withSpring(SCRUB_HOLD_SCALE_X, SCRUB_SPRING);
      scrub_scale_y.value = withSpring(SCRUB_HOLD_SCALE_Y, SCRUB_SPRING);
    } else {
      scrub_scale_x.value = withSpring(1, SCRUB_SPRING);
      scrub_scale_y.value = withSpring(1, SCRUB_SPRING);
    }
  }

  function clear_scrub_active() {
    if (!is_scrubbing_ref.current && !is_holding_ref.current) {
      set_scrub_active(false);
    }
  }

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

  const scrub_gesture = React.useMemo(() => {
    const tap = Gesture.Tap()
      .runOnJS(true)
      .onEnd(event => scrub_to_x(event.x));

    const long_press = Gesture.LongPress()
      .minDuration(SCRUB_HOLD_MIN_DURATION_MS)
      .runOnJS(true)
      .onStart(() => {
        is_holding_ref.current = true;
        set_scrub_active(true);
      })
      .onFinalize(() => {
        is_holding_ref.current = false;
        clear_scrub_active();
      });

    const pan = Gesture.Pan()
      .runOnJS(true)
      .activeOffsetX([-6, 6])
      .failOffsetY([-12, 12])
      .shouldCancelWhenOutside(false)
      .onStart(event => {
        is_scrubbing_ref.current = true;
        is_holding_ref.current = false;
        set_scrub_active(true);
        cancelAnimation(progress);
        scrub_to_x(event.x);
      })
      .onUpdate(event => scrub_to_x(event.x))
      .onFinalize(() => {
        is_scrubbing_ref.current = false;
        clear_scrub_active();
      });

    return Gesture.Race(
      tap,
      Gesture.Simultaneous(long_press, pan),
    );
  }, [progress, scrub_to_x]);

  const fill_style = useAnimatedStyle(() => ({
    width: progress.value * track_width,
  }));

  const track_style = useAnimatedStyle(() => ({
    transform: [
      { scaleX: scrub_scale_x.value },
      { scaleY: scrub_scale_y.value },
    ],
  }));

  const position_label = duration_seconds > 0
    ? `${format_duration(current_time)} of ${format_duration(duration_seconds)}`
    : format_duration(current_time);

  return (
    <GestureDetector gesture={scrub_gesture}>
      <View
        accessibilityHint="Press and hold, then drag horizontally to adjust playback position"
        accessibilityLabel="Playback position"
        accessibilityRole="adjustable"
        accessibilityValue={{ text: position_label }}
        onLayout={handle_layout}
        style={[styles.container, { height: bar_area_height }]}
      >
        <Animated.View
          style={[
            styles.track,
            { backgroundColor: track_color },
            track_style,
          ]}
        >
          <Animated.View style={[styles.fill, { backgroundColor: fill_color }, fill_style]} />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    overflow: 'visible',
    width: '100%',
  },
  fill: {
    borderCurve: 'continuous',
    borderRadius: TRACK_HEIGHT / 2,
    height: TRACK_HEIGHT,
  },
  track: {
    borderCurve: 'continuous',
    borderRadius: TRACK_HEIGHT / 2,
    height: TRACK_HEIGHT,
    overflow: 'hidden',
    width: '100%',
  },
});

export default PlaybackProgressBar;