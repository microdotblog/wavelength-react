jest.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Platform: { OS: 'ios', select: options => options.ios ?? options.default },
  Pressable: 'Pressable',
  StyleSheet: {
    create: styles => styles,
    hairlineWidth: 1,
  },
  Text: 'Text',
  View: 'View',
}));

jest.mock('mobx-react', () => ({
  observer: component => component,
}));

jest.mock('../PlatformSymbol', () => 'PlatformSymbol');
jest.mock('../PlaybackWaveform', () => 'PlaybackWaveform');
jest.mock('../../theme/wavelengthTheme', () => ({
  with_color_opacity: (color, opacity) => color,
}));

const React = require('react');
const TestRenderer = require('react-test-renderer');
const { act } = TestRenderer;
const EpisodeAttachmentToolbar = require('../EpisodeAttachmentToolbar').default;

const theme = {
  colors: {
    accent: '#ff8800',
    button_text: '#ffffff',
    ink: '#24180d',
    ink_soft: '#756657',
  },
  is_dark: false,
};

describe('EpisodeAttachmentToolbar', () => {
  test('shows publishing progress instead of playback controls while publishing', () => {
    let tree;

    act(() => {
      tree = TestRenderer.create(
        React.createElement(EpisodeAttachmentToolbar, {
          duration_seconds: 15,
          episode_title: 'Test Episode',
          is_publishing: true,
          publish_phase: 'uploading',
          status_label: 'Uploading audio…',
          theme,
          waveform: [0.1, 0.5],
        }),
      );
    });

    expect(tree.root.findByProps({ children: 'Uploading audio…' })).toBeTruthy();
    expect(tree.root.findByProps({ accessibilityLabel: 'Publishing progress 60 percent' })).toBeTruthy();
    expect(() => tree.root.findByProps({ accessibilityLabel: 'Play episode preview' })).toThrow();
  });
});
