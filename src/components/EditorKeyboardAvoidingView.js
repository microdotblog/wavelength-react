import React from 'react';
import { LayoutAnimation, View } from 'react-native';
import { runOnJS } from 'react-native-reanimated';
import { useKeyboardHandler } from 'react-native-keyboard-controller';

function visible_height(content_height = 0, keyboard_height = 0) {
  return Math.max(0, content_height - keyboard_height);
}

function EditorKeyboardAvoidingContent({ children, keyboard_height = 0, style, ...props }) {
  const [content_height, set_content_height] = React.useState(0);
  const should_avoid_keyboard = keyboard_height > 0 && content_height > 0;
  const visible = visible_height(content_height, keyboard_height);

  return (
    <View
      {...props}
      onLayout={event => {
        if (keyboard_height > 0) {
          return;
        }

        const height = event?.nativeEvent?.layout?.height || 0;

        if (height > 0) {
          set_content_height(height);
        }
      }}
      style={[
        style,
        should_avoid_keyboard
          ? {
            flex: 0,
            height: visible,
            marginBottom: keyboard_height,
          }
          : {
            marginBottom: 0,
          },
      ]}
    >
      {children}
    </View>
  );
}

export default function EditorKeyboardAvoidingView(props) {
  const [keyboard_height, set_keyboard_height] = React.useState(0);

  const apply_keyboard_height = React.useCallback((height, duration, should_animate) => {
    const next_height = Math.abs(height || 0);

    if (should_animate) {
      const animation_duration = duration > 0 && duration < 10 ? duration * 1000 : duration;

      LayoutAnimation.configureNext({
        duration: animation_duration || 250,
        update: {
          type: LayoutAnimation.Types.keyboard,
        },
      });
    }

    set_keyboard_height(next_height);
  }, []);

  useKeyboardHandler({
    onEnd: event => {
      'worklet';
      runOnJS(apply_keyboard_height)(event.height, event.duration, false);
    },
    onInteractive: event => {
      'worklet';
      runOnJS(apply_keyboard_height)(event.height, event.duration, false);
    },
    onMove: event => {
      'worklet';
      runOnJS(apply_keyboard_height)(event.height, event.duration, false);
    },
    onStart: event => {
      'worklet';
      runOnJS(apply_keyboard_height)(event.height, event.duration, true);
    },
  }, [apply_keyboard_height]);

  return (
    <EditorKeyboardAvoidingContent
      {...props}
      keyboard_height={keyboard_height}
    />
  );
}