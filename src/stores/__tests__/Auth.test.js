jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn(async () => new Uint8Array(16)),
}));

jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(),
}));

jest.mock('react-native', () => ({
  Linking: {
    getInitialURL: jest.fn(async () => null),
  },
}));

const mock_fetch_micropub_config = jest.fn();

jest.mock('../../api/Micropub', () => ({
  fetch_micropub_config: (...args) => mock_fetch_micropub_config(...args),
}));

jest.mock('../../api/MicroBlogAuth', () => ({
  build_micro_blog_auth_url: jest.fn(),
  exchange_micro_blog_code: jest.fn(),
  extract_legacy_wavelength_token: jest.fn(),
  extract_micro_blog_callback_params: jest.fn(),
  get_micro_blog_redirect_uri: jest.fn(),
  is_legacy_wavelength_token_url: jest.fn(),
  is_micro_blog_callback_url: jest.fn(),
  normalize_micro_blog_session: jest.fn((token_payload, verify_payload) => ({
    default_site: verify_payload?.default_site || null,
    has_site: true,
    me: null,
    profile_name: null,
    profile_photo: null,
    profile_url: null,
    token_scope: null,
    username: null,
  })),
  verify_micro_blog_token: jest.fn(),
}));

const mock_clear_selected_destination = jest.fn(async () => null);
const mock_get_selected_destination = jest.fn(() => null);
const mock_set_selected_destination = jest.fn(async () => null);

jest.mock('../Tokens', () => ({
  __esModule: true,
  default: {
    clear_selected_destination: (...args) => mock_clear_selected_destination(...args),
    get_selected_destination: (...args) => mock_get_selected_destination(...args),
    get_user_token: jest.fn(() => 'token'),
    set_selected_destination: (...args) => mock_set_selected_destination(...args),
  },
}));

jest.mock('../WebView', () => ({
  __esModule: true,
  default: {
    bump_web_view_epoch: jest.fn(),
    invalidate_webview_bootstrap: jest.fn(),
  },
}));

const Auth = require('../Auth').default;

describe('Auth destination selection', () => {
  beforeEach(() => {
    Auth.clear_session_data();
    mock_clear_selected_destination.mockClear();
    mock_fetch_micropub_config.mockClear();
    mock_get_selected_destination.mockReset();
    mock_get_selected_destination.mockReturnValue(null);
    mock_set_selected_destination.mockClear();
    mock_fetch_micropub_config.mockResolvedValue({
      destination: [
        {
          name: 'first.micro.blog',
          uid: 'https://first.micro.blog/',
        },
        {
          'microblog-default': true,
          name: 'default.example',
          uid: 'https://default.example/',
        },
      ],
    });
  });

  test('loads destinations and selects the server default', async () => {
    await Auth.load_destinations();

    expect(mock_fetch_micropub_config).toHaveBeenCalledWith({ token: 'token' });
    expect(Auth.destinations).toHaveLength(2);
    expect(Auth.default_site).toBe('https://default.example/');
    expect(Auth.default_site_name).toBe('default.example');
    expect(Auth.is_destination_selected('https://default.example/')).toBe(true);
  });

  test('persists a selected destination for publishing', async () => {
    await Auth.load_destinations();
    const destination = Auth.destinations[0];

    await Auth.select_destination(destination);

    expect(Auth.default_site).toBe('https://first.micro.blog/');
    expect(Auth.default_site_name).toBe('first.micro.blog');
    expect(mock_set_selected_destination).toHaveBeenCalledWith({
      name: 'first.micro.blog',
      uid: 'https://first.micro.blog/',
    });
  });

  test('restores a saved destination when it is still available', async () => {
    mock_get_selected_destination.mockReturnValue({
      name: 'first.micro.blog',
      uid: 'https://first.micro.blog/',
    });

    await Auth.load_destinations();

    expect(Auth.default_site).toBe('https://first.micro.blog/');
    expect(mock_clear_selected_destination).not.toHaveBeenCalled();
  });
});
