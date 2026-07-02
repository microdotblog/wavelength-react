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
const { fireEvent, render } = require('@testing-library/react-native');
const DiscoverPlaybackToolbar = require('../DiscoverPlaybackToolbar').default;

const theme = {
  colors: {
    accent: '#2563eb',
    button_text: '#ffffff',
    ink: '#111827',
    ink_soft: '#6b7280',
  },
  is_dark: false,
};

describe('DiscoverPlaybackToolbar', () => {
  test('renders buffering state with spinner label', async () => {
    const { getByLabelText, getByText } = await render(
      React.createElement(DiscoverPlaybackToolbar, {
        author_name: 'Paul DeFazio',
        current_time: 0,
        duration_seconds: 1613,
        is_buffering: true,
        is_playing: false,
        post_title: 'Conversation post',
        theme,
      }),
    );

    expect(getByText('Buffering…')).toBeTruthy();
    expect(getByLabelText('Buffering audio')).toBeTruthy();
  });

  test('toggles playback and closes', async () => {
    const on_close = jest.fn();
    const on_toggle_playback = jest.fn();

    const { getByLabelText } = await render(
      React.createElement(DiscoverPlaybackToolbar, {
        author_name: 'Paul DeFazio',
        current_time: 12,
        duration_seconds: 1613,
        is_playing: false,
        on_close,
        on_toggle_playback,
        post_title: 'Conversation post',
        theme,
      }),
    );

    fireEvent.press(getByLabelText('Play discover playback'));
    expect(on_toggle_playback).toHaveBeenCalledWith('play');

    fireEvent.press(getByLabelText('Close discover playback'));
    expect(on_close).toHaveBeenCalledTimes(1);
  });
});