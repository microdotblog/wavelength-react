jest.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Alert: { alert: jest.fn() },
  Platform: { OS: 'ios', select: options => options.ios ?? options.default },
  StyleSheet: {
    create: styles => styles,
    flatten: style => {
      if (Array.isArray(style)) {
        return Object.assign({}, ...style.filter(Boolean));
      }

      return style || {};
    },
    hairlineWidth: 1,
  },
  Text: 'Text',
  TextInput: 'TextInput',
  View: 'View',
}));

jest.mock('../../lib/toast', () => ({
  show_toast: jest.fn(),
}));

jest.mock('mobx-react', () => ({
  observer: component => component,
}));

jest.mock('react-native-keyboard-controller', () => ({
  KeyboardStickyView: ({ children }) => children,
}));

jest.mock('expo-audio', () => ({
  useAudioPlayer: () => ({
    pause: jest.fn(),
    play: jest.fn(),
    seekTo: jest.fn(),
  }),
  useAudioPlayerStatus: () => ({
    currentTime: 0,
    didJustFinish: false,
    duration: 60,
    isLoaded: true,
    playing: false,
  }),
}));

jest.mock('react-native-webview', () => ({
  WebView: 'WebView',
}));

jest.mock('../../components/text/HighlightingText', () => {
  const React = require('react');
  const { View } = require('react-native');

  return React.forwardRef((props, ref) => React.createElement(View, {
    accessibilityLabel: props.accessibilityLabel,
    ref,
  }));
});

jest.mock('../../components/EditorKeyboardAvoidingView', () => {
  const React = require('react');
  const { View } = require('react-native');

  const EditorKeyboardFrameContext = React.createContext({
    height: 0,
    keyboard_height: 0,
    window_bottom: 0,
    window_y: 0,
  });

  function EditorKeyboardAvoidingView({ children, style }) {
    return React.createElement(View, { style }, children);
  }

  EditorKeyboardAvoidingView.EditorKeyboardFrameContext = EditorKeyboardFrameContext;

  return {
    __esModule: true,
    EditorKeyboardFrameContext,
    default: EditorKeyboardAvoidingView,
  };
});

jest.mock('../../components/EpisodeAttachmentToolbar', () => {
  const React = require('react');
  const { Text, View } = require('react-native');

  return ({ episode_title }) => React.createElement(
    View,
    null,
    React.createElement(Text, null, 'Attached episode'),
    React.createElement(Text, { accessibilityLabel: 'Play episode preview' }, episode_title),
  );
});

jest.mock('../../components/PublishPostToolbar', () => {
  const React = require('react');
  const { Text, View } = require('react-native');

  return () => React.createElement(
    View,
    null,
    React.createElement(Text, { accessibilityLabel: 'Post options' }, 'Options'),
  );
});

jest.mock('../../components/HeaderPillButton', () => 'HeaderPillButton');

jest.mock('../../theme/wavelengthTheme', () => ({
  header_right_element: () => ({}),
}));

const mock_load_editor_options = jest.fn();
const mock_prep_editor = jest.fn();
const mock_reset = jest.fn();

jest.mock('../../stores/Publishing', () => ({
  __esModule: true,
  default: {
    is_publishing: false,
    load_editor_options: (...args) => mock_load_editor_options(...args),
    post_button_label: () => 'Post',
    post_content: '',
    post_status: 'published',
    post_title: 'Test Episode',
    prep_editor: (...args) => mock_prep_editor(...args),
    reset: (...args) => mock_reset(...args),
    set_post_content: jest.fn(),
    set_post_title: jest.fn(),
    set_text_selection: jest.fn(),
    should_show_title: () => true,
    text_selection_end: 0,
    text_selection_start: 0,
    status_label: () => '',
  },
}));

jest.mock('../../stores/Episodes', () => ({
  __esModule: true,
  default: {
    get_episode: jest.fn(() => ({
      duration_seconds: 60,
      id: 'ep-1',
      playback_clips: () => [{ duration_seconds: 60, name: 'clip-1', uri: 'file:///clip.m4a' }],
      title: 'Test Episode',
      waveform: [0.1, 0.5, 0.2],
    })),
  },
}));

jest.mock('../../stores/Auth', () => ({
  __esModule: true,
  default: {
    current_profile: () => ({ default_site: 'https://test.micro.blog' }),
  },
}));

jest.mock('../../hooks/use_stack_top_inset', () => ({
  use_stack_top_inset: () => 0,
}));

jest.mock('../../hooks/use_episode_playback', () => ({
  use_episode_playback: () => ({
    current_time: 0,
    pause: jest.fn(),
    play: jest.fn(),
    playing: false,
    seek: jest.fn(),
    total_duration: 60,
  }),
}));

const React = require('react');
const { render } = require('@testing-library/react-native');
const PublishScreen = require('../PublishScreen').default;

const theme = {
  colors: {
    accent: '#ff8800',
    button_text: '#ffffff',
    canvas: '#fffaf0',
    ink: '#24180d',
    ink_soft: '#756657',
    line: 'rgba(255, 136, 0, 0.2)',
    paper: '#ffffff',
    paper_alt: '#fff3d2',
  },
  is_dark: false,
};

describe('PublishScreen', () => {
  beforeEach(() => {
    mock_load_editor_options.mockClear();
    mock_prep_editor.mockClear();
    mock_reset.mockClear();
  });

  test('renders title field, content field, and attached episode toolbar from edit publish entry', async () => {
    const { getByLabelText, getByText } = await render(
      React.createElement(PublishScreen, {
        navigation: {
          addListener: jest.fn(() => jest.fn()),
          goBack: jest.fn(),
          navigate: jest.fn(),
          setOptions: jest.fn(),
        },
        route: { params: { episode_id: 'ep-1' } },
        theme,
      }),
    );

    expect(getByLabelText('Episode title')).toBeTruthy();
    expect(getByLabelText('Show notes')).toBeTruthy();
    expect(getByLabelText('Play episode preview')).toBeTruthy();
    expect(getByLabelText('Post options')).toBeTruthy();
    expect(getByText('Attached episode')).toBeTruthy();
    expect(mock_prep_editor).toHaveBeenCalledWith('ep-1');
    expect(mock_load_editor_options).toHaveBeenCalled();
  });
});
