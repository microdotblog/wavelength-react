jest.mock('expo-auth-session', () => ({
  makeRedirectUri: jest.fn(() => 'wavelength://auth/callback'),
}));

jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn(async () => new Uint8Array(16)),
}));

jest.mock('expo-web-browser', () => ({
  dismissAuthSession: jest.fn(),
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

jest.mock('../../api/MicroBlogAuth', () => {
  const actual = jest.requireActual('../../api/MicroBlogAuth');

  return {
    ...actual,
    build_micro_blog_auth_url: jest.fn(() => 'https://micro.blog/indieauth/auth'),
    exchange_micro_blog_code: jest.fn(),
    get_micro_blog_redirect_uri: jest.fn(() => 'wavelength://auth/callback'),
    verify_micro_blog_token: jest.fn(),
  };
});

const mock_clear_selected_destination = jest.fn(async () => null);
const mock_get_selected_destination = jest.fn(() => null);
const mock_set_selected_destination = jest.fn(async () => null);
const mock_tokens_state = {
  pending_oauth_state: null,
  user_token: 'token',
};

jest.mock('../Tokens', () => ({
  __esModule: true,
  default: {
    clear_all: jest.fn(async () => {
      mock_tokens_state.pending_oauth_state = null;
      mock_tokens_state.user_token = '';
    }),
    clear_pending_oauth_state: jest.fn(async () => {
      mock_tokens_state.pending_oauth_state = null;
    }),
    clear_selected_destination: (...args) => mock_clear_selected_destination(...args),
    clear_user_token: jest.fn(async () => {
      mock_tokens_state.user_token = '';
    }),
    get_pending_oauth_state: jest.fn(() => `${mock_tokens_state.pending_oauth_state || ''}`.trim()),
    get_selected_destination: (...args) => mock_get_selected_destination(...args),
    get_user_token: jest.fn(() => `${mock_tokens_state.user_token || ''}`.trim()),
    has_pending_oauth_state: jest.fn(
      () => `${mock_tokens_state.pending_oauth_state || ''}`.trim().length > 0,
    ),
    has_user_token: jest.fn(() => `${mock_tokens_state.user_token || ''}`.trim().length > 0),
    hydrate: jest.fn(async () => {}),
    set_pending_oauth_state: jest.fn(async state => {
      mock_tokens_state.pending_oauth_state = state;
      return state;
    }),
    set_selected_destination: (...args) => mock_set_selected_destination(...args),
    set_user_token: jest.fn(async token => {
      mock_tokens_state.user_token = token;
      return token;
    }),
  },
}));

jest.mock('../WebView', () => ({
  __esModule: true,
  default: {
    bump_web_view_epoch: jest.fn(),
    invalidate_webview_bootstrap: jest.fn(),
  },
}));

const WebBrowser = require('expo-web-browser');
const { exchange_micro_blog_code, verify_micro_blog_token } = require('../../api/MicroBlogAuth');
const Auth = require('../Auth').default;
const Tokens = require('../Tokens').default;

async function wait_for_open_auth_session() {
  for (let i = 0; i < 20; i += 1) {
    if (WebBrowser.openAuthSessionAsync.mock.calls.length > 0) {
      return;
    }

    await Promise.resolve();
  }

  throw new Error('expected Micro.blog auth session to open');
}

describe('Auth destination selection', () => {
  beforeEach(() => {
    Auth.clear_session_data();
    mock_tokens_state.pending_oauth_state = null;
    mock_tokens_state.user_token = 'token';
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

describe('Auth callback URLs while the auth sheet is open', () => {
  beforeEach(() => {
    Auth.clear_session_data();
    Auth.clear_error();
    Auth.finish_sign_in();
    mock_tokens_state.pending_oauth_state = null;
    mock_tokens_state.user_token = '';
    WebBrowser.openAuthSessionAsync.mockReset();
    WebBrowser.dismissAuthSession.mockReset();
    exchange_micro_blog_code.mockReset();
    verify_micro_blog_token.mockReset();
    Tokens.set_user_token.mockClear();
    Tokens.clear_pending_oauth_state.mockClear();
  });

  test('completes Micro.blog sign in from a callback URL while the auth sheet is still open', async () => {
    let resolve_auth_session;
    WebBrowser.openAuthSessionAsync.mockReturnValue(
      new Promise(resolve => {
        resolve_auth_session = resolve;
      }),
    );
    exchange_micro_blog_code.mockResolvedValue({
      access_token: 'access-token',
    });
    verify_micro_blog_token.mockResolvedValue({
      username: 'vincent',
    });

    const sign_in_promise = Auth.sign_in_with_micro_blog();
    await wait_for_open_auth_session();

    expect(Auth.is_signing_in).toBe(true);
    expect(Tokens.has_pending_oauth_state()).toBe(true);

    const callback_url = `wavelength://auth/callback?code=AUTHCODE&state=${Tokens.get_pending_oauth_state()}`;
    const did_handle = await Auth.handle_open_url(callback_url);

    expect(did_handle).toBe(true);
    expect(exchange_micro_blog_code).toHaveBeenCalledWith({ code: 'AUTHCODE' });
    expect(WebBrowser.dismissAuthSession).toHaveBeenCalled();
    expect(Tokens.set_user_token).toHaveBeenCalledWith('access-token');
    expect(Auth.username).toBe('vincent');

    resolve_auth_session({ type: 'dismiss' });
    const did_sign_in = await sign_in_promise;

    expect(did_sign_in).toBe(true);
    expect(Auth.error_message).toBeNull();
    expect(Tokens.has_pending_oauth_state()).toBe(false);
    expect(Auth.is_signing_in).toBe(false);
  });

  test('ignores a mismatched auth callback while the auth sheet is still open', async () => {
    let resolve_auth_session;
    WebBrowser.openAuthSessionAsync.mockReturnValue(
      new Promise(resolve => {
        resolve_auth_session = resolve;
      }),
    );

    const sign_in_promise = Auth.sign_in_with_micro_blog();
    await wait_for_open_auth_session();

    const pending_state = Tokens.get_pending_oauth_state();
    const did_handle = await Auth.handle_open_url(
      'wavelength://auth/callback?code=STALE&state=other-state',
    );

    expect(did_handle).toBe(false);
    expect(Tokens.get_pending_oauth_state()).toBe(pending_state);
    expect(WebBrowser.dismissAuthSession).not.toHaveBeenCalled();
    expect(exchange_micro_blog_code).not.toHaveBeenCalled();

    resolve_auth_session({ type: 'cancel' });
    const did_sign_in = await sign_in_promise;

    expect(did_sign_in).toBe(false);
    expect(Tokens.has_pending_oauth_state()).toBe(false);
  });

  test('exchanges an auth code once when Linking and the auth session both deliver the callback', async () => {
    let resolve_auth_session;
    WebBrowser.openAuthSessionAsync.mockReturnValue(
      new Promise(resolve => {
        resolve_auth_session = resolve;
      }),
    );
    exchange_micro_blog_code.mockResolvedValue({
      access_token: 'access-token',
    });
    verify_micro_blog_token.mockResolvedValue({
      username: 'vincent',
    });

    const sign_in_promise = Auth.sign_in_with_micro_blog();
    await wait_for_open_auth_session();

    const callback_url = `wavelength://auth/callback?code=AUTHCODE&state=${Tokens.get_pending_oauth_state()}`;
    const did_handle = await Auth.handle_open_url(callback_url);
    resolve_auth_session({
      type: 'success',
      url: callback_url,
    });
    const did_sign_in = await sign_in_promise;

    expect(did_handle).toBe(true);
    expect(did_sign_in).toBe(true);
    expect(exchange_micro_blog_code).toHaveBeenCalledTimes(1);
    expect(Tokens.set_user_token).toHaveBeenCalledTimes(1);
    expect(Auth.error_message).toBeNull();
  });

  test('completes a sign-in token URL while the auth sheet is still open', async () => {
    let resolve_auth_session;
    WebBrowser.openAuthSessionAsync.mockReturnValue(
      new Promise(resolve => {
        resolve_auth_session = resolve;
      }),
    );
    verify_micro_blog_token.mockResolvedValue({
      username: 'vincent',
      token: 'app-token',
    });

    const sign_in_promise = Auth.sign_in_with_micro_blog();
    await wait_for_open_auth_session();

    const did_handle = await Auth.handle_open_url('wavelength://signin/app-token');

    expect(did_handle).toBe(true);
    expect(verify_micro_blog_token).toHaveBeenCalledWith('app-token');
    expect(WebBrowser.dismissAuthSession).toHaveBeenCalled();
    expect(Tokens.has_pending_oauth_state()).toBe(false);

    resolve_auth_session({ type: 'dismiss' });
    const did_sign_in = await sign_in_promise;

    expect(did_sign_in).toBe(true);
    expect(Auth.error_message).toBeNull();
    expect(Auth.is_signing_in).toBe(false);
  });
});
