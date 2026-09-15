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

jest.mock('@react-native-menu/menu', () => ({
  MenuView: ({ children }) => children,
}));

jest.mock('../PlatformSymbol', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return function PlatformSymbol({ name }) {
    return React.createElement(Text, null, name);
  };
});

jest.mock('expo-image', () => ({
  Image: 'Image',
}));

jest.mock('../../theme/wavelengthTheme', () => ({
  with_color_opacity: color => color,
}));

const { build_discover_row_actions } = require('../DiscoverPostRow');

const theme = {
  colors: {
    ink: '#24180d',
  },
};

describe('build_discover_row_actions', () => {
  test('offers play, open, and listen later on Discover', () => {
    expect(
      build_discover_row_actions({
        is_playable: true,
        is_saved: false,
        theme,
      }).map(action => action.id),
    ).toEqual(['play', 'open', 'listen_later']);
  });

  test('labels play as pause when the episode is already playing', () => {
    const actions = build_discover_row_actions({
      is_playable: true,
      is_playing: true,
      is_saved: false,
      theme,
    });

    expect(actions[0]).toMatchObject({
      id: 'play',
      title: 'Pause',
    });
  });

  test('omits play when the episode has no audio', () => {
    expect(
      build_discover_row_actions({
        is_playable: false,
        is_saved: false,
        theme,
      }).map(action => action.id),
    ).toEqual(['open', 'listen_later']);
  });

  test('offers remove instead of listen later when the episode is saved', () => {
    const actions = build_discover_row_actions({
      is_playable: true,
      is_saved: true,
      theme,
    });

    expect(actions.map(action => action.id)).toEqual(['play', 'open', 'remove']);
    expect(actions[2].attributes).toEqual({ destructive: true });
  });
});
