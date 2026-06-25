import React from 'react';
import { LayoutAnimation, View } from 'react-native';
import { runOnJS } from 'react-native-reanimated';
import { useKeyboardHandler } from 'react-native-keyboard-controller';

export const EditorKeyboardFrameContext = React.createContext({
  height: 0,
  keyboard_height: 0,
  window_bottom: 0,
  window_y: 0,
});

class EditorKeyboardAvoidingContent extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      content_height: 0,
      keyboard_height: 0,
      visible_height: 0,
      window_y: 0,
    };
    this.container = React.createRef();
  }

  componentDidMount() {
    this.update_keyboard_height(this.props.keyboard_height);
  }

  componentDidUpdate(prev_props) {
    if (prev_props.keyboard_height !== this.props.keyboard_height) {
      this.update_keyboard_height(this.props.keyboard_height);
    }
  }

  update_keyboard_height(keyboard_height) {
    const next_keyboard_height = Math.max(0, keyboard_height || 0);
    const next_visible_height = this.visible_height(this.state.content_height, next_keyboard_height);

    this.setState({
      keyboard_height: next_keyboard_height,
      visible_height: next_visible_height,
    }, this.measure_in_window);
  }

  measure_in_window = () => {
    this.container.current?.measureInWindow((x, y) => {
      if (y !== this.state.window_y) {
        this.setState({
          window_y: y,
        });
      }
    });
  };

  handle_layout = event => {
    this.props.onLayout?.(event);

    if (this.state.keyboard_height > 0) {
      return;
    }

    const height = event?.nativeEvent?.layout?.height || 0;

    if (height > 0 && height !== this.state.content_height) {
      this.setState({
        content_height: height,
        visible_height: this.visible_height(height, this.state.keyboard_height),
      }, this.measure_in_window);
    }
  };

  visible_height(content_height, keyboard_height) {
    return Math.max(0, content_height - keyboard_height);
  }

  render() {
    const view_props = {
      ...this.props,
    };
    delete view_props.keyboard_height;

    const { children, style, ...props } = view_props;
    const should_avoid_keyboard = this.state.keyboard_height > 0 && this.state.content_height > 0;
    const keyboard_style = should_avoid_keyboard
      ? {
        flex: 0,
        height: this.state.visible_height,
        marginBottom: this.state.keyboard_height,
      }
      : {
        marginBottom: 0,
      };

    return (
      <View
        ref={this.container}
        {...props}
        onLayout={this.handle_layout}
        style={[
          style,
          keyboard_style,
        ]}
      >
        <EditorKeyboardFrameContext.Provider
          value={{
            height: this.state.visible_height || this.state.content_height,
            keyboard_height: this.state.keyboard_height,
            window_bottom: this.state.window_y + (this.state.visible_height || this.state.content_height),
            window_y: this.state.window_y,
          }}
        >
          {children}
        </EditorKeyboardFrameContext.Provider>
      </View>
    );
  }
}

export default function EditorKeyboardAvoidingView(props) {
  const [keyboard_event_height, set_keyboard_event_height] = React.useState(0);

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

    set_keyboard_event_height(next_height);
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
      keyboard_height={keyboard_event_height}
    />
  );
}