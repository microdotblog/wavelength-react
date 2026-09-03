let url_event_handler = null;

jest.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Linking: {
    addEventListener: jest.fn((type, handler) => {
      if (type === 'url') {
        url_event_handler = handler;
      }

      return { remove: jest.fn() };
    }),
    getInitialURL: jest.fn(async () => null),
  },
  Modal: 'Modal',
  StyleSheet: {
    create: styles => styles,
  },
  Text: 'Text',
  View: 'View',
  useColorScheme: () => 'light',
}));

jest.mock('expo-status-bar', () => ({
  StatusBar: 'StatusBar',
}));

jest.mock('expo-system-ui', () => ({
  setBackgroundColorAsync: jest.fn(async () => {}),
}));

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
}));

jest.mock('mobx-react', () => ({
  observer: component => component,
}));

jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: ({ children }) => children,
}));

jest.mock('@react-navigation/native', () => ({
  NavigationContainer: ({ children }) => children,
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }) => children,
}));

jest.mock('react-native-keyboard-controller', () => ({
  KeyboardProvider: ({ children }) => children,
}));

jest.mock('../navigation/SignedInNavigator', () => () => null);
jest.mock('../screens/WelcomeScreen', () => () => null);
jest.mock('../theme/wavelengthTheme', () => ({
  build_navigation_theme: () => ({}),
  get_wavelength_theme: () => ({
    is_dark: false,
    colors: {
      accent: '#ff8800',
      canvas: '#fffaf0',
      ink: '#24180d',
      line: '#eee',
      paper: '#fff',
    },
  }),
}));

jest.mock('../stores/Episodes', () => ({
  is_upgrading_legacy: false,
}));

const mock_handle_open_url = jest.fn();

jest.mock('../stores/Auth', () => ({
  can_handle_open_url: jest.fn(() => true),
  handle_open_url: (...args) => mock_handle_open_url(...args),
  hydrate: jest.fn(async () => {}),
  is_hydrating: false,
  is_signed_in: () => false,
  is_signing_in: true,
}));

const React = require('react');
const { render } = require('@testing-library/react-native');
const App = require('../App').default;
const Auth = require('../stores/Auth');

describe('App auth callback URLs', () => {
  beforeEach(async () => {
    url_event_handler = null;
    mock_handle_open_url.mockReset();
    Auth.can_handle_open_url.mockReset();
    Auth.can_handle_open_url.mockReturnValue(true);
    Auth.is_signing_in = true;

    await render(React.createElement(App));
  });

  test('signs in from a Micro.blog auth callback while the auth sheet is still open', () => {
    const callback_url =
      'wavelength://auth/callback?code=27D1AEC374F9F621CB2D&state=4f36064754e102267754952f2535ce21';

    url_event_handler({ url: callback_url });

    expect(mock_handle_open_url).toHaveBeenCalledWith(callback_url);
  });
});
