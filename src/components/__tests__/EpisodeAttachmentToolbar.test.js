jest.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Platform: { OS: 'ios', select: options => options.ios ?? options.default },
  Pressable: 'Pressable',
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
const { render } = require('@testing-library/react-native');
const EpisodeAttachmentToolbar = require('../EpisodeAttachmentToolbar').default;

const theme = {
  colors: {
    accent: '#ff8800',
    accent_strong: '#cc6600',
    button_text: '#ffffff',
    ink: '#24180d',
    ink_soft: '#756657',
  },
  is_dark: false,
};

describe('EpisodeAttachmentToolbar', () => {
  test('shows publishing progress instead of playback controls while publishing', async () => {
    const { getByLabelText, getByText, queryByLabelText } = await render(
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

    expect(getByText('Uploading audio…')).toBeTruthy();
    expect(getByLabelText('Publishing progress 60 percent')).toBeTruthy();
    expect(queryByLabelText('Play episode preview')).toBeNull();
  });

  test('shows file size and upload warning when provided', async () => {
    const { getByText } = await render(
      React.createElement(EpisodeAttachmentToolbar, {
        current_time: 5,
        duration_seconds: 15,
        episode_title: 'Test Episode',
        file_size_label: '82 MB',
        theme,
        upload_warning: 'This episode is 82 MB. Micro.blog uploads must be 75 MB or smaller.',
        waveform: [0.1, 0.5],
      }),
    );

    expect(getByText('0:05 / 0:15 · 82 MB')).toBeTruthy();
    expect(getByText('This episode is 82 MB. Micro.blog uploads must be 75 MB or smaller.')).toBeTruthy();
  });
});
