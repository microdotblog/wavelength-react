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

jest.mock('../../stores/Discover', () => ({
  __esModule: true,
  default: {
    selected_filter: 'discover',
    set_selected_filter: jest.fn(),
    visible_did_hydrate: () => true,
    visible_is_loading: () => false,
  },
}));

const React = require('react');
const { fireEvent, render } = require('@testing-library/react-native');
const Discover = require('../../stores/Discover').default;
const DiscoverFilterMenu = require('../DiscoverFilterMenu').default;
const {
  build_ios_discover_filter_header_items,
  discover_is_pending,
} = require('../DiscoverFilterMenu');

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

describe('discover_is_pending', () => {
  test('treats an unhydrated or loading list as pending', () => {
    expect(discover_is_pending({ did_hydrate: false, is_loading: false })).toBe(true);
    expect(discover_is_pending({ did_hydrate: false, is_loading: true })).toBe(true);
    expect(discover_is_pending({ did_hydrate: true, is_loading: true })).toBe(true);
    expect(discover_is_pending({ did_hydrate: true, is_loading: false })).toBe(false);
  });
});

describe('build_ios_discover_filter_header_items', () => {
  test('uses a native menu labeled with the current filter', () => {
    const items = build_ios_discover_filter_header_items({
      did_hydrate: true,
      is_loading: false,
      selected_filter: 'discover',
    });

    expect(items).toHaveLength(1);
    expect(items[0].type).toBe('menu');
    expect(items[0].label).toBe('Discover');
    expect(items[0].menu.items.map(item => item.state)).toEqual(['on', 'off']);
    expect(items[0].menu.items.map(item => item.label)).toEqual([
      'Discover',
      'Listen Later',
    ]);
    expect(items[0].menu.items.map(item => item.icon)).toEqual([
      { name: 'sparkles', type: 'sfSymbol' },
      { name: 'bookmark', type: 'sfSymbol' },
    ]);
  });

  test('keeps the loading item until the selected list has hydrated', () => {
    const items = build_ios_discover_filter_header_items({
      did_hydrate: false,
      is_loading: false,
      selected_filter: 'listen_later',
      spinner: 'spinner',
    });

    expect(items[0].type).toBe('custom');
    expect(items[0].accessibilityLabel).toBe('Loading Listen Later');
    expect(items[1].label).toBe('Listen Later');
  });
});

describe('DiscoverFilterMenu', () => {
  beforeEach(() => {
    Discover.selected_filter = 'discover';
    Discover.visible_did_hydrate = () => true;
    Discover.visible_is_loading = () => false;
    Discover.set_selected_filter.mockClear();
  });

  test('shows a loading indicator until Discover has hydrated', async () => {
    Discover.visible_did_hydrate = () => false;
    const { getByLabelText } = await render(
      React.createElement(DiscoverFilterMenu, { theme }),
    );

    expect(getByLabelText('Loading Discover')).toBeTruthy();
  });

  test('shows the current filter and selects Listen Later from the menu', async () => {
    const { getByLabelText, getByText } = await render(
      React.createElement(DiscoverFilterMenu, { theme }),
    );

    expect(getByText('Discover')).toBeTruthy();
    expect(getByLabelText('Discover').props.accessibilityState.selected).toBe(true);

    fireEvent.press(getByLabelText('Listen Later'));
    expect(Discover.set_selected_filter).toHaveBeenCalledWith('listen_later');
  });
});
