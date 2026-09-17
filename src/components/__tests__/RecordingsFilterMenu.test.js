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

jest.mock('../../stores/Episodes', () => ({
  __esModule: true,
  default: {
    did_hydrate: true,
    is_loading: false,
    selected_filter: 'all',
    set_selected_filter: jest.fn(),
  },
}));

jest.mock('../../stores/Posts', () => ({
  __esModule: true,
  default: {
    did_hydrate: true,
    error_message: null,
    is_loading: false,
  },
}));

const React = require('react');
const { fireEvent, render } = require('@testing-library/react-native');
const Episodes = require('../../stores/Episodes').default;
const RecordingsFilterMenu = require('../RecordingsFilterMenu').default;
const { build_ios_recordings_filter_header_items } = require('../RecordingsFilterMenu');

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

describe('build_ios_recordings_filter_header_items', () => {
  test('uses a native menu labeled with the current filter', () => {
    const on_record = jest.fn();
    const items = build_ios_recordings_filter_header_items({
      did_hydrate: true,
      is_loading: false,
      on_record,
      selected_filter: 'all',
      show_record: true,
    });

    expect(items.map(item => item.type)).toEqual(['menu', 'button']);
    expect(items[0].label).toBe('All');
    expect(items[0].menu.items.map(item => item.state)).toEqual(['on', 'off', 'off']);
    expect(items[0].menu.items.map(item => item.icon)).toEqual([
      { name: 'square.stack', type: 'sfSymbol' },
      { name: 'waveform', type: 'sfSymbol' },
      { name: 'microphone', type: 'sfSymbol' },
    ]);
    expect(items[1].label).toBe('Record');

    items[1].onPress();
    expect(on_record).toHaveBeenCalled();
  });

  test('omits Record and shows a spinner until recordings hydrate', () => {
    const items = build_ios_recordings_filter_header_items({
      did_hydrate: false,
      is_loading: true,
      selected_filter: 'all',
      show_record: false,
      spinner: 'spinner',
    });

    expect(items.map(item => item.type)).toEqual(['custom', 'menu']);
    expect(items[0].accessibilityLabel).toBe('Loading recordings');
  });
});

describe('RecordingsFilterMenu', () => {
  beforeEach(() => {
    Episodes.did_hydrate = true;
    Episodes.is_loading = false;
    Episodes.selected_filter = 'all';
    Episodes.set_selected_filter.mockClear();
  });

  test('shows the current filter and selects another from the menu', async () => {
    const { getByLabelText, getByText } = await render(
      React.createElement(RecordingsFilterMenu, { theme }),
    );

    expect(getByText('All')).toBeTruthy();
    expect(getByLabelText('All').props.accessibilityState.selected).toBe(true);

    fireEvent.press(getByLabelText('Narrations'));
    expect(Episodes.set_selected_filter).toHaveBeenCalledWith('narrations');
  });
});
