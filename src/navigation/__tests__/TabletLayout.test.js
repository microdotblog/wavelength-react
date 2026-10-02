let mock_dimensions = { width: 1133, height: 744 };

jest.mock('react-native', () => ({
  Alert: { alert: jest.fn() },
  Platform: { OS: 'ios', isPad: true },
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
  ScreenStackHeaderRightView: 'ScreenStackHeaderRightView',
  ScreenStackItem: 'ScreenStackItem',
}));

jest.mock('react-native-screens/experimental', () => ({
  SafeAreaView: 'SafeAreaView',
  Split: { Host: 'SplitHost', Column: 'SplitColumn' },
}));

jest.mock('react-native-sfsymbols', () => ({ SFSymbol: 'SFSymbol' }));
jest.mock('../../components/HeaderProfileButton', () => 'HeaderProfileButton');
jest.mock('@react-navigation/bottom-tabs/unstable', () => ({ createNativeBottomTabNavigator: () => ({}) }));
jest.mock('../stacks/RecordingsStack', () => 'RecordingsStack');
jest.mock('../stacks/PostsStack', () => 'PostsStack');
jest.mock('../stacks/DiscoverStack', () => 'DiscoverStack');
jest.mock('../../../assets/icons/tab_bar/recordings.png', () => 1);
jest.mock('../../../assets/icons/tab_bar/posts.png', () => 2);
jest.mock('../../../assets/icons/tab_bar/discover.png', () => 3);
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
const { Alert, Text } = require('react-native');
const { fireEvent, render } = require('@testing-library/react-native');
const TabletLayout = require('../TabletLayout').default;
const { is_wide_tablet_window } = require('../TabletLayout');
const { SidebarVisibleContext, use_sidebar_navigation_guard } = require('../SidebarContext');
const { TabContentLayout } = require('../TabNavigator');

const parent_navigation = { navigate: jest.fn() };
const navigation = {
  getParent: () => parent_navigation,
  popTo: jest.fn(),
  reset: jest.fn(),
};
const tab_routes = ['RecordingsStack', 'PostsStack', 'DiscoverStack', 'RecordAction']
  .map(name => ({ key: name, name }));
const descriptors = Object.fromEntries(tab_routes.map(route => [
  route.key,
  { render: () => <Text testID="tab-content">{route.name}</Text> },
]));

const content_mounted = jest.fn();

function Content({ notice, route_key }) {
  const sidebar_visible = React.useContext(SidebarVisibleContext);
  use_sidebar_navigation_guard(route_key, () => notice);
  React.useEffect(() => { content_mounted(); }, []);
  return <Text testID="content">{`Detail stack: ${sidebar_visible ? 'wide' : 'narrow'}`}</Text>;
}

function layout(tab_index = 0, content_route = null, notice = null, extra_route = null) {
  const main_tabs = {
    key: 'main-tabs',
    name: 'MainTabs',
    state: { index: tab_index, routes: tab_routes },
  };
  const routes = content_route ? [main_tabs, content_route] : [main_tabs];
  if (extra_route) {
    routes.push(extra_route);
  }

  return (
    <TabletLayout navigation={navigation} state={{ index: routes.length - 1, routes }}>
      <Content notice={notice} route_key={content_route?.key} />
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

function header_controls(screen) {
  const header = find_hosts(screen.root, 'ScreenStackItem')[0].props.headerConfig;
  return React.Children.toArray(header.children.props.children);
}

test('keeps the detail stack inside the split view and returns to the selected section', async () => {
  const screen = await render(layout(1, { key: 'edit-post', name: 'PostEdit' }));
  const host = screen.root;

  expect(host.type).toBe('SplitHost');
  expect(host.props.preferredDisplayMode).toBe('oneBesideSecondary');
  expect(find_hosts(host, 'SplitColumn')).toHaveLength(2);
  expect(screen.getByText('Posts').parent.props.accessibilityState.selected).toBe(true);
  expect(screen.getByTestId('content').props.children).toBe('Detail stack: wide');
  expect(screen.queryByText('RecordAction')).toBeNull();

  await fireEvent.press(screen.getByText('Discover').parent);
  expect(navigation.popTo).toHaveBeenCalledWith('MainTabs', { screen: 'DiscoverStack' });
  await screen.rerender(layout(2));
  expect(screen.getByText('Discover').parent.props.accessibilityState.selected).toBe(true);

  const [profile, record] = header_controls(screen);
  expect(profile.type).toBe('ScreenStackHeaderLeftView');
  expect(record.type).toBe('ScreenStackHeaderRightView');
  expect(record.props.children.props.accessibilityLabel).toBe('New recording');
  record.props.children.props.onPress();
  expect(navigation.reset).toHaveBeenCalledWith({
    index: 1,
    routes: [expect.objectContaining({ key: 'main-tabs', name: 'MainTabs' }), { name: 'Record' }],
  });

  profile.props.children.props.onPress();
  expect(parent_navigation.navigate).toHaveBeenCalledWith('Account');
});

test('keeps a pushed screen mounted when rotating between wide and narrow windows', async () => {
  const route = { key: 'record', name: 'Record' };
  const screen = await render(layout(0, route));
  const content = screen.getByTestId('content');

  expect(content.props.children).toBe('Detail stack: wide');
  mock_dimensions = { width: 744, height: 1133 };
  await screen.rerender(layout(0, route));

  expect(screen.root.props.preferredDisplayMode).toBe('secondaryOnly');
  expect(screen.getByTestId('content')).toBe(content);
  expect(content.props.children).toBe('Detail stack: narrow');
  mock_dimensions = { width: 1133, height: 744 };
  await screen.rerender(layout(0, route));
  expect(content.props.children).toBe('Detail stack: wide');
  expect(content_mounted).toHaveBeenCalledTimes(1);
  expect(is_wide_tablet_window(768, 700)).toBe(true);
  expect(is_wide_tablet_window(767, 700)).toBe(false);
});

test('blocks sidebar navigation until an unfinished recording is saved or discarded', async () => {
  const route = { key: 'narrate', name: 'Narrate' };
  const notice = { title: 'Recording in progress', message: 'Save or discard this narration.' };
  const screen = await render(layout(0, route, notice));

  await fireEvent.press(screen.getByText('Posts').parent);
  header_controls(screen)[1].props.children.props.onPress();
  expect(Alert.alert).toHaveBeenCalledWith(notice.title, notice.message);
  expect(navigation.popTo).not.toHaveBeenCalled();
  expect(navigation.reset).not.toHaveBeenCalled();

  await screen.rerender(layout(0, route));
  await fireEvent.press(screen.getByText('Posts').parent);
  expect(navigation.popTo).toHaveBeenCalledWith('MainTabs', { screen: 'PostsStack' });
});

test('leaves post edits intact until discarding is confirmed, including when Options is pushed', async () => {
  const route = { key: 'edit-post', name: 'PostEdit' };
  const notice = { can_discard: true, message: 'Your post changes have not been saved.' };
  const screen = await render(layout(1, route, notice, { key: 'options', name: 'PublishOptions' }));

  await fireEvent.press(screen.getByText('Discover').parent);
  expect(navigation.popTo).not.toHaveBeenCalled();
  const buttons = Alert.alert.mock.calls[0][2];
  expect(buttons[0]).toEqual({ style: 'cancel', text: 'Keep editing' });
  buttons[1].onPress();
  expect(navigation.popTo).toHaveBeenCalledWith('MainTabs', { screen: 'DiscoverStack' });

  navigation.reset.mockClear();
  header_controls(screen)[1].props.children.props.onPress();
  expect(navigation.reset).not.toHaveBeenCalled();
  Alert.alert.mock.calls[1][2][1].onPress();
  expect(navigation.reset).toHaveBeenCalled();
});

test('shows the selected section on wide iPads and native tabs when the sidebar is hidden', async () => {
  function tabs(visible, index) {
    return (
      <SidebarVisibleContext.Provider value={visible}>
        <TabContentLayout descriptors={descriptors} state={{ index, routes: tab_routes }}>
          <Text testID="tab-content">Native tabs</Text>
        </TabContentLayout>
      </SidebarVisibleContext.Provider>
    );
  }

  const screen = await render(tabs(true, 1));
  expect(screen.getByTestId('tab-content').props.children).toBe('PostsStack');
  await screen.rerender(tabs(true, 2));
  expect(screen.getByTestId('tab-content').props.children).toBe('DiscoverStack');
  await screen.rerender(tabs(false, 2));
  expect(screen.getByTestId('tab-content').props.children).toBe('Native tabs');
});
