import React from 'react';
import { Keyboard, Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { EditorKeyboardFrameContext } from '../EditorKeyboardAvoidingView';
import { with_color_opacity } from '../../theme/wavelengthTheme';
import editorHtml from './editor_html';

const MICRO_BLOG_BASE_URL = 'https://micro.blog';

export default class HighlightingText extends React.Component {
  static contextType = EditorKeyboardFrameContext;

  constructor(props) {
    super(props);
    this.state = {
      container_height: 0,
      editor_surface_ready: false,
      keyboard_scroll_request: 0,
      measured_editor_height: 0,
    };
    this.container = React.createRef();
    this.webview = React.createRef();
    this.is_ready = false;
    this.last_webview_text = this.normalized_value(props);
    this.last_webview_selection = this.serialized_selection(props.selection);
    this.last_config = null;
    this.keyboard_is_visible = false;
    this.keyboard_show_listener = null;
    this.keyboard_hide_listener = null;
    this.pending_focus_options = null;
  }

  componentDidMount() {
    const show_event = Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow';
    const hide_event = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    this.keyboard_show_listener = Keyboard.addListener(show_event, this.handle_keyboard_change);
    this.keyboard_hide_listener = Keyboard.addListener(hide_event, this.handle_keyboard_hide);
  }

  componentDidUpdate(prev_props, prev_state) {
    this.measure_editor_height();

    if (!this.is_ready) {
      return;
    }

    const value = this.normalized_value(this.props);
    const previous_value = this.normalized_value(prev_props);
    const selection = this.serialized_selection(this.props.selection);
    const previous_selection = this.serialized_selection(prev_props.selection);
    const config = this.editor_config();
    const config_serialized = JSON.stringify(config);
    const value_changed_externally = value !== previous_value && value !== this.last_webview_text;
    const selection_changed_externally = selection !== previous_selection
      && selection !== this.last_webview_selection;
    const config_changed = config_serialized !== this.last_config;
    const keyboard_scroll_requested = this.state.keyboard_scroll_request
      !== prev_state.keyboard_scroll_request;

    if (value_changed_externally || selection_changed_externally || config_changed || keyboard_scroll_requested) {
      this.sync_editor({
        focus: selection_changed_externally,
        include_selection: selection_changed_externally,
        include_value: value_changed_externally,
        scrollSelectionIntoView: keyboard_scroll_requested,
      });
    }
  }

  componentWillUnmount() {
    this.keyboard_show_listener?.remove();
    this.keyboard_hide_listener?.remove();
  }

  normalized_value(props = this.props) {
    return props.value || '';
  }

  flattened_style() {
    return StyleSheet.flatten(this.props.style) || {};
  }

  theme_colors() {
    const theme = this.props.theme || {};
    const colors = theme.colors || {};
    const is_dark = theme.is_dark === true;
    const canvas = colors.canvas || (is_dark ? '#15100b' : '#fffaf0');

    return {
      accent_color: colors.accent || '#ff8800',
      background_color: canvas,
      bottom_scrim_color: with_color_opacity(canvas, is_dark ? 0.86 : 0.82),
      code_background_color: colors.paper_alt || (is_dark ? '#2d2115' : '#fff3d2'),
      placeholder_text_color: colors.ink_soft || '#9ca3af',
      text_color: colors.ink || (is_dark ? '#fff7e8' : '#24180d'),
    };
  }

  editor_config() {
    const style = this.flattened_style();
    const padding = style.padding != null ? style.padding : 0;
    const theme_colors = this.theme_colors();

    return {
      backgroundColor: style.backgroundColor || theme_colors.background_color,
      bottomOverlayHeight: this.props.bottomOverlayHeight || 0,
      bottomScrimColor: theme_colors.bottom_scrim_color,
      caretColor: this.props.caretColor || theme_colors.accent_color,
      codeBackgroundColor: theme_colors.code_background_color,
      colorScheme: this.props.theme?.is_dark ? 'dark' : 'light',
      editable: this.props.editable !== false,
      fontSize: style.fontSize || 18,
      paddingBottom: style.paddingBottom != null ? style.paddingBottom : padding,
      paddingLeft: style.paddingLeft != null ? style.paddingLeft : padding,
      paddingRight: style.paddingRight != null ? style.paddingRight : padding,
      paddingTop: style.paddingTop != null ? style.paddingTop : padding,
      placeholderTextColor: this.props.placeholderTextColor || theme_colors.placeholder_text_color,
      textColor: style.color || theme_colors.text_color,
      viewportHeight: this.editor_height(),
    };
  }

  build_injected_theme_script() {
    const config = this.editor_config();
    const payload = JSON.stringify({
      backgroundColor: config.backgroundColor,
      bottomScrimColor: config.bottomScrimColor,
      caretColor: config.caretColor,
      codeBackgroundColor: config.codeBackgroundColor,
      colorScheme: config.colorScheme,
      placeholderTextColor: config.placeholderTextColor,
      textColor: config.textColor,
    });

    return `
      (function () {
        var config = ${payload};

        function applyEarlyTheme() {
          var root = document.documentElement;
          var body = document.body;

          if (!body) {
            return;
          }

          var targets = [root, body];
          body.classList.toggle('dark', config.colorScheme === 'dark');

          function setVar(name, value) {
            if (!value) {
              return;
            }

            targets.forEach(function (target) {
              target.style.setProperty(name, value);
            });
          }

          if (config.backgroundColor) {
            setVar('--editor-background', config.backgroundColor);
            targets.forEach(function (target) {
              target.style.background = config.backgroundColor;
            });
          }

          setVar('--editor-text', config.textColor);
          setVar('--editor-caret', config.caretColor || config.textColor);
          setVar('--editor-placeholder', config.placeholderTextColor);
          setVar('--editor-code-background', config.codeBackgroundColor);
          setVar('--editor-bottom-scrim', config.bottomScrimColor);
        }

        applyEarlyTheme();
        document.addEventListener('DOMContentLoaded', applyEarlyTheme);
      })();
      true;
    `;
  }

  editor_height() {
    return this.state.measured_editor_height || this.state.container_height;
  }

  webview_style() {
    const style = {
      ...this.flattened_style(),
      backgroundColor: this.editor_config().backgroundColor,
      padding: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      paddingRight: 0,
      paddingTop: 0,
    };

    delete style.alignItems;
    delete style.color;
    delete style.fontSize;
    delete style.justifyContent;
    delete style.textAlignVertical;

    if (this.context?.keyboard_height > 0) {
      delete style.minHeight;
    }

    const editor_height = this.editor_height();

    if (editor_height > 0) {
      style.flex = 0;
      style.height = editor_height;
      delete style.minHeight;
    }

    return style;
  }

  serialized_selection(selection) {
    const parsed = this.parse_selection(selection);
    return `${parsed.start} ${parsed.end}`;
  }

  parse_selection(selection) {
    if (selection == null || selection === '') {
      return {
        end: 0,
        start: 0,
      };
    }

    if (typeof selection === 'string') {
      const pieces = selection.trim().split(/\s+/);
      const start = Number.parseInt(pieces[0], 10);
      const end = Number.parseInt(pieces[1], 10);

      return {
        end: Number.isFinite(end) ? end : Number.isFinite(start) ? start : 0,
        start: Number.isFinite(start) ? start : 0,
      };
    }

    if (typeof selection === 'object') {
      const start = Number.parseInt(selection.start, 10);
      const end = Number.parseInt(selection.end, 10);

      return {
        end: Number.isFinite(end) ? end : Number.isFinite(start) ? start : 0,
        start: Number.isFinite(start) ? start : 0,
      };
    }

    return {
      end: 0,
      start: 0,
    };
  }

  inject_javascript(script) {
    this.webview.current?.injectJavaScript(`${script}\ntrue;`);
  }

  request_scroll_selection_into_view() {
    this.setState(state => ({
      keyboard_scroll_request: state.keyboard_scroll_request + 1,
    }));
  }

  focus(options = {}) {
    const focus_options = {
      cursorToEnd: options.cursorToEnd !== false,
      scrollSelectionIntoView: options.scrollSelectionIntoView !== false,
    };

    if (!this.is_ready) {
      this.pending_focus_options = focus_options;
      return;
    }

    this.pending_focus_options = null;
    this.sync_editor({
      cursorToEnd: focus_options.cursorToEnd,
      focus: true,
      scrollSelectionIntoView: focus_options.scrollSelectionIntoView,
    });
  }

  handle_keyboard_change = () => {
    this.keyboard_is_visible = true;
    this.measure_editor_height();
    this.request_scroll_selection_into_view();
  };

  handle_keyboard_hide = () => {
    this.keyboard_is_visible = false;
  };

  handle_layout = event => {
    const height = event?.nativeEvent?.layout?.height || 0;

    if (height > 0 && height !== this.state.container_height) {
      this.setState({
        container_height: height,
      }, this.measure_editor_height);
    } else {
      this.measure_editor_height();
    }

    if (this.keyboard_is_visible) {
      this.request_scroll_selection_into_view();
    }
  };

  measure_editor_height = () => {
    if (this.context?.window_bottom <= 0) {
      return;
    }

    this.container.current?.measureInWindow((x, y) => {
      const height = Math.max(0, this.context.window_bottom - y);

      if (height > 0 && height !== this.state.measured_editor_height) {
        this.setState({
          measured_editor_height: height,
        });
      }
    });
  };

  measured_webview_style() {
    const editor_height = this.editor_height();

    if (editor_height <= 0) {
      return null;
    }

    return {
      flex: 0,
      height: editor_height,
    };
  }

  sync_editor(options = {}) {
    const config = this.editor_config();
    const payload = {
      ...config,
      cursorToEnd: !!(options.cursorToEnd || (options.initial && this.props.autoFocus)),
      focus: options.focus || (options.initial && this.props.autoFocus),
      scrollSelectionIntoView: !!options.scrollSelectionIntoView,
    };

    if (options.include_value) {
      payload.value = this.normalized_value();
      this.last_webview_text = payload.value;
    }

    if (options.include_selection) {
      payload.selection = this.parse_selection(this.props.selection);
      this.last_webview_selection = this.serialized_selection(this.props.selection);
    }

    this.last_config = JSON.stringify(config);
    this.inject_javascript(`window.MicroBlogReactEditor.updateFromReact(${JSON.stringify(payload)})`);
  }

  handle_message = event => {
    let message = null;

    try {
      message = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }

    if (message.type === 'ready') {
      this.is_ready = true;
      this.setState({ editor_surface_ready: true });
      this.sync_editor({
        include_selection: true,
        include_value: true,
        initial: true,
      });

      if (this.pending_focus_options) {
        this.focus(this.pending_focus_options);
      }

      return;
    }

    if (message.type === 'change') {
      const text = message.payload?.text || '';
      this.last_webview_text = text;

      if (message.payload?.selection) {
        this.last_webview_selection = this.serialized_selection(message.payload.selection);
      }

      this.props.onChangeText?.({
        nativeEvent: {
          text,
        },
      });
      return;
    }

    if (message.type === 'selection') {
      const selection = message.payload || {
        end: 0,
        start: 0,
      };
      this.last_webview_selection = this.serialized_selection(selection);
      this.props.onSelectionChange?.({
        nativeEvent: {
          selection,
        },
      });
    }
  };

  should_start_load = request => {
    const url = request.url || '';
    return url === 'about:blank' || url.startsWith(MICRO_BLOG_BASE_URL);
  };

  render() {
    const config = this.editor_config();
    const { accessibilityLabel } = this.props;

    return (
      <View
        accessibilityLabel={accessibilityLabel}
        onLayout={this.handle_layout}
        ref={this.container}
        style={this.webview_style()}
      >
        <WebView
          automaticallyAdjustContentInsets={false}
          bounces={false}
          containerStyle={{ backgroundColor: config.backgroundColor }}
          contentInsetAdjustmentBehavior="never"
          domStorageEnabled={false}
          hideKeyboardAccessoryView
          injectedJavaScriptBeforeContentLoaded={this.build_injected_theme_script()}
          javaScriptEnabled
          keyboardDisplayRequiresUserAction={false}
          onMessage={this.handle_message}
          onShouldStartLoadWithRequest={this.should_start_load}
          originWhitelist={['*']}
          overScrollMode={Platform.OS === 'android' ? 'never' : undefined}
          ref={this.webview}
          scrollEnabled={this.props.scrollEnabled !== false}
          setSupportMultipleWindows={false}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          source={{ baseUrl: MICRO_BLOG_BASE_URL, html: editorHtml }}
          style={[
            styles.webview,
            this.measured_webview_style(),
            {
              backgroundColor: config.backgroundColor,
              opacity: this.state.editor_surface_ready ? 1 : 0,
            },
          ]}
        />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  webview: {
    flex: 1,
  },
});