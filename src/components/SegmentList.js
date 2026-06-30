import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import SegmentRow from './SegmentRow';
import SegmentSwipeRow from './SegmentSwipeRow';
import { with_color_opacity } from '../theme/wavelengthTheme';

const ROW_GAP = 10;
const DRAG_ACTIVATE_MS = 150;
const SPRING_CONFIG = { damping: 22, mass: 0.7, stiffness: 220 };

function noop() {}

function build_positions(names) {
  const positions = {};

  names.forEach((name, index) => {
    positions[name] = index;
  });

  return positions;
}

function ordered_names(positions) {
  return Object.keys(positions).sort((first, second) => positions[first] - positions[second]);
}

function clamp(value, lower, upper) {
  'worklet';

  return Math.min(Math.max(value, lower), upper);
}

function name_at_index(positions, target_index) {
  'worklet';

  const names = Object.keys(positions);

  for (let index = 0; index < names.length; index += 1) {
    if (positions[names[index]] === target_index) {
      return names[index];
    }
  }

  return '';
}

function DragHandle({ theme }) {
  const color = with_color_opacity(theme.colors.ink_soft, theme.is_dark ? 0.85 : 0.7);

  return (
    <View style={styles.handleGrip}>
      <View style={[styles.handleLine, { backgroundColor: color }]} />
      <View style={[styles.handleLine, { backgroundColor: color }]} />
      <View style={[styles.handleLine, { backgroundColor: color }]} />
    </View>
  );
}

function SegmentItem({
  active_clip_index,
  active_name,
  clip,
  count,
  grouped,
  index,
  onDelete,
  onMove,
  onReorder,
  onSplit,
  on_swipe_will_open,
  positions,
  readOnly = false,
  slot,
  theme,
}) {
  const name = clip.name;
  const translate_y = useSharedValue(index * slot);
  const start_y = useSharedValue(0);
  const is_dragging = useSharedValue(false);
  const reorder_ref = React.useRef(onReorder);

  reorder_ref.current = onReorder;

  const report_reorder = React.useCallback(() => {
    reorder_ref.current(ordered_names(positions.value));
  }, [positions]);

  useAnimatedReaction(
    () => positions.value[name],
    (next_index, previous_index) => {
      if (next_index == null || is_dragging.value || next_index === previous_index) {
        return;
      }

      translate_y.value = withSpring(next_index * slot, SPRING_CONFIG);
    },
    [slot],
  );

  const pan = React.useMemo(
    () =>
      Gesture.Pan()
        .enabled(!readOnly)
        .activateAfterLongPress(DRAG_ACTIVATE_MS)
        .onStart(() => {
          is_dragging.value = true;
          active_name.value = name;
          start_y.value = positions.value[name] * slot;
        })
        .onUpdate(event => {
          translate_y.value = start_y.value + event.translationY;

          const next_index = clamp(Math.round(translate_y.value / slot), 0, count - 1);
          const current_index = positions.value[name];

          if (next_index !== current_index) {
            const swap_name = name_at_index(positions.value, next_index);

            if (swap_name !== '') {
              const updated = Object.assign({}, positions.value);
              updated[swap_name] = current_index;
              updated[name] = next_index;
              positions.value = updated;
            }
          }
        })
        .onFinalize(() => {
          if (!is_dragging.value) {
            return;
          }

          is_dragging.value = false;
          active_name.value = '';
          translate_y.value = withSpring(positions.value[name] * slot, SPRING_CONFIG);
          runOnJS(report_reorder)();
        }),
    [active_name, count, is_dragging, name, positions, readOnly, report_reorder, slot, start_y, translate_y],
  );

  const item_style = useAnimatedStyle(() => {
    const dragging = active_name.value === name;

    return {
      elevation: dragging ? 6 : 0,
      shadowOpacity: withSpring(dragging ? 0.16 : 0, SPRING_CONFIG),
      transform: [
        { translateY: translate_y.value },
        { scale: withSpring(dragging ? 1.03 : 1, SPRING_CONFIG) },
      ],
      zIndex: dragging ? 20 : 1,
    };
  });

  function handle_accessibility_action(event) {
    const action_name = event.nativeEvent.actionName;

    if (action_name === 'increment') {
      onMove(index, index + 1);
    } else if (action_name === 'decrement') {
      onMove(index, index - 1);
    }
  }

  return (
    <Animated.View style={[styles.item, item_style]}>
      {readOnly ? (
        <SegmentRow
          clip={clip}
          grouped={grouped}
          index={index}
          is_active={index === active_clip_index}
          readOnly
          showDivider={index < count - 1}
          theme={theme}
        />
      ) : (
        <SegmentSwipeRow
          on_delete={() => onDelete(index)}
          on_will_open={on_swipe_will_open}
        >
          <SegmentRow
            clip={clip}
            grouped={grouped}
            index={index}
            is_active={index === active_clip_index}
            onDelete={() => onDelete(index)}
            onPress={() => onSplit(clip)}
            showDivider={index < count - 1}
            theme={theme}
            handle={
              <GestureDetector gesture={pan}>
                <Animated.View
                  accessibilityActions={[
                    { label: 'Move up', name: 'decrement' },
                    { label: 'Move down', name: 'increment' },
                  ]}
                  accessibilityLabel={`Reorder segment ${index + 1}`}
                  accessibilityRole="adjustable"
                  onAccessibilityAction={handle_accessibility_action}
                  style={styles.handleHit}
                >
                  <DragHandle theme={theme} />
                </Animated.View>
              </GestureDetector>
            }
          />
        </SegmentSwipeRow>
      )}
    </Animated.View>
  );
}

function SegmentList({
  active_clip_index = -1,
  clips,
  grouped = false,
  onDelete,
  onMove,
  onReorder,
  onSplit,
  readOnly = false,
  theme,
}) {
  const names = clips.map(clip => clip.name);
  const names_key = names.join('|');
  const positions = useSharedValue(build_positions(names));
  const active_name = useSharedValue('');
  const open_swipeable_ref = React.useRef(null);
  const [row_height, set_row_height] = React.useState(0);

  function handle_swipe_will_open(swipeable) {
    if (open_swipeable_ref.current && open_swipeable_ref.current !== swipeable) {
      open_swipeable_ref.current.close?.();
    }

    open_swipeable_ref.current = swipeable;
  }

  React.useEffect(() => {
    positions.value = build_positions(names_key.length > 0 ? names_key.split('|') : []);
  }, [names_key, positions]);

  function handle_measure(event) {
    const next_height = event.nativeEvent.layout.height;

    if (next_height > 0 && Math.abs(next_height - row_height) > 0.5) {
      set_row_height(next_height);
    }
  }

  const slot = row_height + ROW_GAP;
  const container_height = row_height > 0 && clips.length > 0 ? clips.length * slot - ROW_GAP : 0;

  return (
    <View style={[styles.container, { height: container_height }]}>
      {clips.length > 0 ? (
        <View onLayout={handle_measure} pointerEvents="none" style={styles.measure}>
          <SegmentRow
            clip={clips[0]}
            grouped={grouped}
            handle={<DragHandle theme={theme} />}
            index={0}
            onPress={noop}
            theme={theme}
          />
        </View>
      ) : null}

      {row_height > 0
        ? clips.map((clip, index) => (
            <SegmentItem
              active_clip_index={active_clip_index}
              active_name={active_name}
              clip={clip}
              count={clips.length}
              grouped={grouped}
              index={index}
              key={clip.name}
              onDelete={onDelete}
              onMove={onMove}
              onReorder={onReorder}
              onSplit={onSplit}
              on_swipe_will_open={handle_swipe_will_open}
              positions={positions}
              readOnly={readOnly}
              slot={slot}
              theme={theme}
            />
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  handleGrip: {
    gap: 3,
  },
  handleHit: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  handleLine: {
    borderRadius: 1,
    height: 2,
    width: 18,
  },
  item: {
    left: 0,
    position: 'absolute',
    right: 0,
    shadowColor: '#000',
    shadowOffset: { height: 4, width: 0 },
    shadowRadius: 8,
    top: 0,
  },
  measure: {
    left: 0,
    opacity: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
});

export default SegmentList;
