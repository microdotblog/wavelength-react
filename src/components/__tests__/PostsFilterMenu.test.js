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

jest.mock('@react-native-menu/menu', () => ({
  MenuView: ({ actions, children, onPressAction }) => {
    const React = require('react');
    const { Pressable, View } = require('react-native');

    return React.createElement(
      View,
      null,
      children,
      ...(actions || []).map(action => React.createElement(Pressable, {
        accessibilityLabel: action.title,
        accessibilityState: { selected: action.state === 'on' },
        key: action.id,
        onPress: () => onPressAction({ nativeEvent: { event: action.id } }),
      })),
    );
  },
}));

jest.mock('../../theme/wavelengthTheme', () => ({
  is_liquid_glass: () => false,
  with_color_opacity: color => color,
}));

jest.mock('../../stores/Posts', () => ({
  __esModule: true,
  default: {
    did_hydrate: true,
    is_loading: false,
    selected_filter: 'podcasts',
    set_selected_filter: jest.fn(),
  },
}));

const React = require('react');
const { fireEvent, render } = require('@testing-library/react-native');
const Posts = require('../../stores/Posts').default;
const PostsFilterMenu = require('../PostsFilterMenu').default;
const { build_ios_posts_filter_header_items } = require('../PostsFilterMenu');

const theme = {
  colors: {
    accent: '#ff8800',
    accent_strong: '#ff8800',
    ink: '#24180d',
    line: 'rgba(255, 136, 0, 0.2)',
    paper: '#ffffff',
  },
  is_dark: false,
};

describe('build_ios_posts_filter_header_items', () => {
  test('uses a native menu labeled with the current filter', () => {
    const items = build_ios_posts_filter_header_items({
      did_hydrate: true,
      is_loading: false,
      selected_filter: 'podcasts',
    });

    expect(items).toHaveLength(1);
    expect(items[0].type).toBe('menu');
    expect(items[0].label).toBe('Podcasts');
    expect(items[0].menu.items.map(item => item.state)).toEqual(['off', 'off', 'on', 'off']);
  });
});

describe('PostsFilterMenu', () => {
  beforeEach(() => {
    Posts.did_hydrate = true;
    Posts.is_loading = false;
    Posts.selected_filter = 'podcasts';
    Posts.set_selected_filter.mockClear();
  });

  test('shows a loading indicator until posts have hydrated', async () => {
    Posts.did_hydrate = false;
    const { getByLabelText } = await render(
      React.createElement(PostsFilterMenu, { theme }),
    );

    expect(getByLabelText('Loading posts')).toBeTruthy();
  });

  test('shows the current filter and selects another from the menu', async () => {
    const { getByLabelText, getByText } = await render(
      React.createElement(PostsFilterMenu, { theme }),
    );

    expect(getByText('Podcasts')).toBeTruthy();
    expect(getByLabelText('Podcasts').props.accessibilityState.selected).toBe(true);

    fireEvent.press(getByLabelText('Narrated'));
    expect(Posts.set_selected_filter).toHaveBeenCalledWith('narrated');
  });
});
