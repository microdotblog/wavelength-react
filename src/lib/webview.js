const DEFAULT_THEME = 'light';

export function normalise_theme(theme = null) {
  return theme === 'dark' ? 'dark' : DEFAULT_THEME;
}

const decode_query_value = (value = '') => {
  return decodeURIComponent(`${value}`.replace(/\+/g, ' '));
};

const parse_query_params = (query = '') => {
  if (!query) {
    return [];
  }

  return query
    .split('&')
    .filter(Boolean)
    .map(part => {
      const [raw_key, ...raw_value_parts] = part.split('=');

      return [
        decode_query_value(raw_key),
        decode_query_value(raw_value_parts.join('=')),
      ];
    });
};

const has_query_param = (params = [], key = '') => {
  return params.some(([current_key]) => current_key === key);
};

const set_query_param = (params = [], key = '', value = '') => {
  const next_params = [];
  let did_set = false;

  params.forEach(([current_key, current_value]) => {
    if (current_key === key) {
      if (!did_set) {
        next_params.push([key, value]);
        did_set = true;
      }

      return;
    }

    next_params.push([current_key, current_value]);
  });

  if (!did_set) {
    next_params.push([key, value]);
  }

  return next_params;
};

const serialise_query_params = (params = []) => {
  return params
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(`${value}`)}`)
    .join('&');
};

export function get_base_webview_path(url_or_endpoint = '') {
  let path = `${url_or_endpoint}`.replace(/^https?:\/\/[^/]+/, '');
  path = path.replace(/^\//, '');
  path = path.split('?')[0].split('#')[0];
  return path;
}

export function is_signin_webview_path(url_or_endpoint = '') {
  return get_base_webview_path(url_or_endpoint) === 'hybrid/signin';
}

export function is_webview_endpoint_url({ endpoint = '', url = '' }) {
  return get_base_webview_path(endpoint) === get_base_webview_path(url);
}

export function build_webview_endpoint({ endpoint = '', show_actions = true, theme = DEFAULT_THEME }) {
  const hash_parts = `${endpoint}`.split('#');
  const path_and_query = hash_parts[0] ?? '';
  const hash = hash_parts.length > 1 ? `#${hash_parts.slice(1).join('#')}` : '';
  const query_index = path_and_query.indexOf('?');
  const path = query_index > -1 ? path_and_query.slice(0, query_index) : path_and_query;
  const query = query_index > -1 ? path_and_query.slice(query_index + 1) : '';
  let params = parse_query_params(query);

  params = set_query_param(params, 'theme', normalise_theme(theme));

  if (!hash) {
    if (show_actions && !has_query_param(params, 'show_actions')) {
      params.push(['show_actions', 'true']);
    }

    if (!has_query_param(params, 'fontsize')) {
      params.push(['fontsize', '17']);
    }
  }

  const query_string = serialise_query_params(params);

  return `${path}${query_string ? `?${query_string}` : ''}${hash}`;
}

export function build_webview_source_uri({
  did_load_one_or_more_webviews = false,
  endpoint = '',
  show_actions = true,
  theme = DEFAULT_THEME,
  token = '',
  web_url = '',
}) {
  const prepared_endpoint = build_webview_endpoint({ endpoint, show_actions, theme });

  if (did_load_one_or_more_webviews) {
    return `${web_url}/${prepared_endpoint}`;
  }

  const signin_params = [
    ['token', token],
    ['redirect_to', prepared_endpoint],
    ['theme', normalise_theme(theme)],
  ];

  if (show_actions) {
    signin_params.push(['show_actions', 'true']);
  }

  const query_string = serialise_query_params(signin_params);

  return `${web_url}/hybrid/signin?${query_string}`;
}

export function should_attempt_webview_recovery({
  did_load_one_or_more_webviews = false,
  has_attempted_recovery = false,
  url = '',
}) {
  if (!did_load_one_or_more_webviews || has_attempted_recovery) {
    return false;
  }

  return !is_signin_webview_path(url);
}

const decode_webview_tap_payload = (value = '') => {
  try {
    return decodeURI(value);
  } catch {
    return value;
  }
};

export function resolve_webview_tap_url(url = '') {
  const trimmed = `${url}`.trim();

  if (!trimmed) {
    return null;
  }

  const scheme_match = trimmed.match(/^microblog:\/\/([^/?#]+)\/?(.*)$/i);

  if (!scheme_match) {
    return null;
  }

  const action = `${scheme_match[1]}`.toLowerCase();
  const action_data = scheme_match[2] ?? '';

  switch (action) {
    case 'open':
    case 'reply':
      return action_data ? `https://micro.blog/${action_data}` : null;
    case 'user':
      return action_data ? `https://micro.blog/${action_data}` : null;
    case 'photo':
      return decode_webview_tap_payload(
        trimmed.includes('://photo/') ? trimmed.split('://photo/')[1] : action_data,
      );
    case 'video':
      return decode_webview_tap_payload(
        trimmed.includes('://video/') ? trimmed.split('://video/')[1] : action_data,
      );
    default:
      return null;
  }
}

export function resolve_webview_navigation({ endpoint = '', url = '' }) {
  if (is_signin_webview_path(url)) {
    return { action: 'allow' };
  }

  if (is_webview_endpoint_url({ endpoint, url })) {
    return { action: 'allow' };
  }

  const tap_url = resolve_webview_tap_url(url);

  if (tap_url) {
    return { action: 'block', open_url: tap_url };
  }

  return { action: 'block', open_url: url };
}
