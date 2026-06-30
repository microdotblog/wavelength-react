import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { RectButton } from 'react-native-gesture-handler';
import Reanimated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';

const DELETE_ACTION_WIDTH = 80;
const DELETE_ACTION_GAP = 8;
const DELETE_ACTION_TOTAL_WIDTH = DELETE_ACTION_WIDTH + DELETE_ACTION_GAP;
const DELETE_ACTION_COLOR = '#FF3B30';
const SWIPE_SPRING = {
  damping: 18,
  mass: 0.62,
  overshootClamping: false,
  stiffness: 210,
};

function SegmentDeleteAction({ on_delete_press, progress, translation }) {
  const animated_style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.3, 1], [0, 0.55, 1], Extrapolation.CLAMP),
    transform: [
      {
        translateX: interpolate(
          translation.value,
          [-DELETE_ACTION_TOTAL_WIDTH, 0],
          [0, DELETE_ACTION_TOTAL_WIDTH],
          Extrapolation.CLAMP,
        ),
      },
      {
        scale: interpolate(progress.value, [0, 0.55, 1], [0.88, 0.96, 1], Extrapolation.CLAMP),
      },
    ],
  }));

  return (
    <Reanimated.View style={[styles.deleteActionContainer, animated_style]}>
      <RectButton
        accessibilityLabel="Delete"
        accessibilityRole="button"
        onPress={on_delete_press}
        style={styles.deleteActionButton}
      >
        <Text style={styles.deleteActionLabel}>Delete</Text>
      </RectButton>
    </Reanimated.View>
  );
}

function SegmentSwipeRow({ children, on_delete, on_will_open }) {
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
    borderRadius: 18,
    flex: 1,
    justifyContent: 'center',
    width: DELETE_ACTION_WIDTH,
  },
  deleteActionContainer: {
    height: '100%',
    justifyContent: 'center',
    paddingLeft: DELETE_ACTION_GAP,
    width: DELETE_ACTION_TOTAL_WIDTH,
  },
  deleteActionLabel: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 19,
  },
});

export default SegmentSwipeRow;