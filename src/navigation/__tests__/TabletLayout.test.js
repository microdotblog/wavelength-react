let mock_dimensions = { width: 1133, height: 744 };

jest.mock('react-native', () => ({
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: {
    create: styles => styles,
    flatten: style => Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style || {},
  },
  Text: 'Text',
  View: 'View',
  useColorScheme: () => 'light',
  useWindowDimensions: () => mock_dimensions,
}));

jest.mock('react-native-screens', () => ({
  ScreenStack: 'ScreenStack',
  ScreenStackHeaderLeftView: 'ScreenStackHeaderLeftView',
  ScreenStackItem: 'ScreenStackItem',
}));

jest.mock('react-native-screens/experimental', () => ({
  SafeAreaView: 'SafeAreaView',
  Split: { Host: 'SplitHost', Column: 'SplitColumn' },
}));

jest.mock('react-native-sfsymbols', () => ({ SFSymbol: 'SFSymbol' }));
jest.mock('../../components/HeaderProfileButton', () => 'HeaderProfileButton');
jest.mock('../../theme/wavelengthTheme', () => ({
  get_wavelength_theme: () => ({
    colors: {
      accent: '#ff8800',
      accent_soft: '#fff1c6',
      button_text: '#ffffff',
      ink: '#24180d',
    },
  }),
}));

const React = require('react');
const { Text } = require('react-native');
const { fireEvent, render } = require('@testing-library/react-native');
const TabletLayout = require('../TabletLayout').default;
const { SidebarVisibleContext, is_wide_tablet_window } = require('../TabletLayout');

const parent_navigation = { navigate: jest.fn() };
const navigation = {
  getParent: () => parent_navigation,
  navigate: jest.fn(),
};
const routes = ['RecordingsStack', 'PostsStack', 'DiscoverStack', 'RecordAction']
  .map(name => ({ key: name, name }));

function Content() {
  const sidebar_visible = React.useContext(SidebarVisibleContext);
  return <Text testID="content">{sidebar_visible ? 'wide' : 'narrow'}</Text>;
}

function layout(index = 0) {
  return (
    <TabletLayout navigation={navigation} state={{ index, routes }}>
      <Content />
    </TabletLayout>
  );
}

function find_hosts(node, type) {
  const matches = node.type === type ? [node] : [];
  const children = node.children.filter(child => typeof child !== 'string');
  return matches.concat(children.flatMap(child => find_hosts(child, type)));
}

beforeEach(() => {
  mock_dimensions = { width: 1133, height: 744 };
  jest.clearAllMocks();
});

test('uses the sidebar for wide iPad windows and preserves the current section', async () => {
  const screen = await render(layout(1));
  const host = screen.root;

  expect(host.type).toBe('SplitHost');
  expect(host.props.preferredDisplayMode).toBe('oneBesideSecondary');
  expect(find_hosts(host, 'SplitColumn')).toHaveLength(2);
  expect(screen.getByText('Posts').parent.props.accessibilityState.selected).toBe(true);
  expect(screen.queryByText('RecordAction')).toBeNull();

  await fireEvent.press(screen.getByText('Discover').parent);
  expect(navigation.navigate).toHaveBeenCalledWith('DiscoverStack');

  await fireEvent.press(screen.getByLabelText('New recording'));
  expect(parent_navigation.navigate).toHaveBeenCalledWith('Record');

  const header = find_hosts(host, 'ScreenStackItem')[0].props.headerConfig;
  header.children.props.children.props.onPress();
  expect(parent_navigation.navigate).toHaveBeenCalledWith('Account');
});

test('keeps the content mounted when the window becomes narrow', async () => {
  const screen = await render(layout());
  const content = screen.getByTestId('content');

  expect(content.props.children).toBe('wide');
  mock_dimensions = { width: 744, height: 1133 };
  await screen.rerender(layout());

  expect(screen.root.props.preferredDisplayMode).toBe('secondaryOnly');
  expect(screen.getByTestId('content')).toBe(content);
  expect(content.props.children).toBe('narrow');
  expect(is_wide_tablet_window(768, 700)).toBe(true);
  expect(is_wide_tablet_window(767, 700)).toBe(false);
});
