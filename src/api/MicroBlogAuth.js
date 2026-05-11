import * as AuthSession from 'expo-auth-session';

export const MICRO_BLOG_AUTH_URL = 'https://micro.blog/indieauth/auth';
export const MICRO_BLOG_TOKEN_URL = 'https://micro.blog/indieauth/token';
export const MICRO_BLOG_VERIFY_URL = 'https://micro.blog/account/verify';
export const MICRO_BLOG_CLIENT_ID = 'https://micro.blog/wavelength/';
export const MICRO_BLOG_SCOPE = 'create';
export const MICRO_BLOG_REDIRECT_PATH = 'auth/callback';
export const WAVELENGTH_SCHEME = 'wavelength';

export function get_micro_blog_redirect_uri() {
  return AuthSession.makeRedirectUri({
    path: MICRO_BLOG_REDIRECT_PATH,
    scheme: WAVELENGTH_SCHEME,
  });
}

export function build_micro_blog_auth_url({
  client_id = MICRO_BLOG_CLIENT_ID,
  redirect_uri = get_micro_blog_redirect_uri(),
  state,
} = {}) {
  const params = new URLSearchParams({
    client_id,
    redirect_uri,
    response_type: 'code',
    scope: MICRO_BLOG_SCOPE,
    state,
    wavelength: 1,
  });

  return `${MICRO_BLOG_AUTH_URL}?${params.toString()}`;
}

export function extract_micro_blog_callback_params(raw_url = '') {
  if (!raw_url) {
    return {
      code: '',
      state: '',
    };
  }

  try {
    const parsed_url = new URL(raw_url);

    return {
      code: parsed_url.searchParams.get('code')?.trim() || '',
      state: parsed_url.searchParams.get('state')?.trim() || '',
    };
  } catch (error) {
    return {
      code: '',
      state: '',
    };
  }
}

export function extract_legacy_wavelength_token(raw_url = '') {
  if (!raw_url) {
    return '';
  }

  try {
    const parsed_url = new URL(raw_url);

    if (parsed_url.protocol !== `${WAVELENGTH_SCHEME}:`) {
      return '';
    }

    if (parsed_url.host !== 'micropub' && parsed_url.host !== 'signin') {
      return '';
    }

    return parsed_url.pathname.split('/').filter(Boolean).pop()?.trim() || '';
  } catch (error) {
    return '';
  }
}

export function is_micro_blog_callback_url(raw_url = '') {
  if (!raw_url) {
    return false;
  }

  try {
    const parsed_url = new URL(raw_url);
    const matches_host_callback =
      parsed_url.host === 'auth' && parsed_url.pathname === '/callback';
    const matches_path_callback = parsed_url.pathname === `/${MICRO_BLOG_REDIRECT_PATH}`;

    return parsed_url.protocol === `${WAVELENGTH_SCHEME}:` &&
      (matches_host_callback || matches_path_callback);
  } catch (error) {
    return false;
  }
}

export function is_legacy_wavelength_token_url(raw_url = '') {
  return extract_legacy_wavelength_token(raw_url).length > 0;
}

export async function exchange_micro_blog_code({
  client_id = MICRO_BLOG_CLIENT_ID,
  code,
  redirect_uri = get_micro_blog_redirect_uri(),
} = {}) {
  const body = new URLSearchParams({
    client_id,
    code,
    grant_type: 'authorization_code',
    redirect_uri,
  });

  const response = await fetch(MICRO_BLOG_TOKEN_URL, {
    body: body.toString(),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    method: 'POST',
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload?.error) {
    throw create_request_error(
      payload?.error_description || payload?.error || 'Micro.blog token exchange failed.',
      response.status,
    );
  }

  return payload;
}

export async function verify_micro_blog_token(token = '') {
  const trimmed_token = `${token || ''}`.trim();

  if (!trimmed_token) {
    throw create_request_error('A Micro.blog token is required before verification.');
  }

  const body = new URLSearchParams({ token: trimmed_token });
  const response = await fetch(MICRO_BLOG_VERIFY_URL, {
    body: body.toString(),
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${trimmed_token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    method: 'POST',
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload?.error) {
    throw create_request_error(
      payload?.error || 'Micro.blog verify failed.',
      response.status || 401,
    );
  }

  return payload;
}

export function normalize_micro_blog_session(token_payload = null, verify_payload = null) {
  const profile = token_payload?.profile || {};
  const username =
    `${verify_payload?.username || profile?.nickname || ''}`.replace(/^@/, '').trim() || null;

  return {
    default_site: `${verify_payload?.default_site || ''}`.trim() || null,
    has_site:
      typeof verify_payload?.has_site === 'boolean' ? verify_payload.has_site : null,
    me: `${token_payload?.me || verify_payload?.me || profile?.url || ''}`.trim() || null,
    profile_name:
      `${verify_payload?.name || profile?.name || username || ''}`.trim() || null,
    profile_photo:
      `${verify_payload?.avatar || verify_payload?.photo || profile?.photo || ''}`.trim() || null,
    profile_url:
      `${verify_payload?.url || profile?.url || token_payload?.me || verify_payload?.me || ''}`
        .trim() || null,
    token_scope: `${token_payload?.scope || ''}`.trim() || null,
    username,
  };
}

function create_request_error(message, status = null) {
  const error = new Error(message);
  error.status = status;
  return error;
}
