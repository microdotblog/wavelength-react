import React from 'react';
import { StyleSheet, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { RectButton } from 'react-native-gesture-handler';
import Reanimated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';

import PlatformSymbol from './PlatformSymbol';

const DELETE_ACTION_SIZE = 56;
const COMPACT_DELETE_ACTION_SIZE = 44;
const DELETE_ACTION_GAP = 8;
const COMPACT_DELETE_ACTION_RIGHT_GAP = 8;
const DELETE_ACTION_COLOR = '#FF3B30';
const SWIPE_SPRING = {
  damping: 18,
  mass: 0.62,
  overshootClamping: false,
  stiffness: 210,
};

function SegmentDeleteAction({ compact, on_delete_press, progress, translation }) {
  const action_size = compact ? COMPACT_DELETE_ACTION_SIZE : DELETE_ACTION_SIZE;
  const action_right_gap = compact ? COMPACT_DELETE_ACTION_RIGHT_GAP : 0;
  const action_total_width = action_size + DELETE_ACTION_GAP + action_right_gap;
  const animated_style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.3, 1], [0, 0.55, 1], Extrapolation.CLAMP),
    transform: [
      {
        translateX: interpolate(
          translation.value,
          [-action_total_width, 0],
          [0, action_total_width],
          Extrapolation.CLAMP,
        ),
      },
      {
        scale: interpolate(progress.value, [0, 0.55, 1], [0.88, 0.96, 1], Extrapolation.CLAMP),
      },
    ],
  }));

  return (
    <Reanimated.View
      style={[
        styles.deleteActionContainer,
        {
          paddingRight: action_right_gap,
          width: action_total_width,
        },
        animated_style,
      ]}
    >
      <RectButton
        accessibilityLabel="Delete"
        accessibilityRole="button"
        onPress={on_delete_press}
        style={[
          styles.deleteActionButton,
          {
            borderRadius: action_size / 2,
            height: action_size,
            width: action_size,
          },
        ]}
      >
        <PlatformSymbol color="#ffffff" name="trash" size={compact ? 18 : 20} />
      </RectButton>
    </Reanimated.View>
  );
}

function SegmentSwipeRow({ children, compact = false, on_delete, on_will_open }) {
  const swipeable_ref = React.useRef(null);

  function handle_delete_press() {
    swipeable_ref.current?.close();
    on_delete();
  }

  function handle_will_open() {
    on_will_open?.(swipeable_ref.current);
  }

  return (
    <ReanimatedSwipeable
      animationOptions={SWIPE_SPRING}
      enableTrackpadTwoFingerGesture
      friction={1.1}
      onSwipeableWillOpen={handle_will_open}
      overshootFriction={5}
      overshootRight
      ref={swipeable_ref}
      renderRightActions={(progress, translation) => (
        <SegmentDeleteAction
          compact={compact}
          on_delete_press={handle_delete_press}
          progress={progress}
          translation={translation}
        />
      )}
      rightThreshold={32}
    >
      <View style={styles.content}>{children}</View>
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
  },
  deleteActionButton: {
    alignItems: 'center',
    backgroundColor: DELETE_ACTION_COLOR,
    borderCurve: 'continuous',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  deleteActionContainer: {
    height: '100%',
    justifyContent: 'center',
    paddingLeft: DELETE_ACTION_GAP,
  },
});

export default SegmentSwipeRow;
