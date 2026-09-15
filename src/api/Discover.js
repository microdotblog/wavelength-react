export const MICRO_BLOG_DISCOVER_URL = 'https://micro.blog/posts/discover';
export const MICRO_BLOG_LISTEN_LATER_URL = 'https://micro.blog/posts/bookmarks/listenlater';
export const MICRO_BLOG_BOOKMARKS_URL = 'https://micro.blog/posts/bookmarks';
export const DISCOVER_PODCASTS_TOPIC = 'podcasts';
export const DISCOVER_PAGE_SIZE = 40;
export const LISTEN_LATER_PAGE_SIZE = 25;

export async function fetch_discover_posts({
  before_id = '',
  token = '',
  topic = DISCOVER_PODCASTS_TOPIC,
} = {}) {
  const trimmed_topic = `${topic || ''}`.trim();

  if (!trimmed_topic) {
    throw create_request_error('Discover topic is required.');
  }

  const url = new URL(`${MICRO_BLOG_DISCOVER_URL}/${trimmed_topic}`);
  const trimmed_before_id = `${before_id || ''}`.trim();

  if (trimmed_before_id) {
    url.searchParams.set('before_id', trimmed_before_id);
  }

  const headers = {
    Accept: 'application/json',
  };
  const trimmed_token = `${token || ''}`.trim();

  if (trimmed_token) {
    headers.Authorization = `Bearer ${trimmed_token}`;
  }

  const response = await fetch(url.toString(), {
    headers,
    method: 'GET',
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.error) {
    throw create_request_error(
      resolve_error_message(payload, 'We could not load Discover posts.'),
      response.status,
    );
  }

  return payload;
}

export async function fetch_listen_later_posts({
  before_id = '',
  token = '',
} = {}) {
  const trimmed_token = `${token || ''}`.trim();

  if (!trimmed_token) {
    throw create_request_error('You need to be signed in to Micro.blog to load Listen Later.');
  }

  const url = new URL(MICRO_BLOG_LISTEN_LATER_URL);
  const trimmed_before_id = `${before_id || ''}`.trim();

  if (trimmed_before_id) {
    url.searchParams.set('before_id', trimmed_before_id);
  }

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${trimmed_token}`,
    },
    method: 'GET',
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.error) {
    throw create_request_error(
      resolve_error_message(payload, 'We could not load Listen Later.'),
      response.status,
    );
  }

  return payload;
}

export async function save_listen_later({
  id = '',
  token = '',
} = {}) {
  const trimmed_token = `${token || ''}`.trim();
  const trimmed_id = `${id || ''}`.trim();

  if (!trimmed_token) {
    throw create_request_error(
      'You need to be signed in to Micro.blog to save Listen Later episodes.',
    );
  }

  if (!trimmed_id) {
    throw create_request_error('A Discover episode is required.');
  }

  const url = new URL(MICRO_BLOG_BOOKMARKS_URL);
  url.searchParams.set('id', trimmed_id);

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${trimmed_token}`,
    },
    method: 'POST',
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload?.error) {
    throw create_request_error(
      resolve_error_message(payload, 'We could not save that Listen Later episode.'),
      response.status,
    );
  }

  return true;
}

export async function remove_listen_later({
  id = '',
  token = '',
} = {}) {
  const trimmed_token = `${token || ''}`.trim();
  const trimmed_id = `${id || ''}`.trim();

  if (!trimmed_token) {
    throw create_request_error(
      'You need to be signed in to Micro.blog to remove Listen Later episodes.',
    );
  }

  if (!trimmed_id) {
    throw create_request_error('A Listen Later episode is required.');
  }

  const response = await fetch(`${MICRO_BLOG_BOOKMARKS_URL}/${encodeURIComponent(trimmed_id)}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${trimmed_token}`,
    },
    method: 'DELETE',
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload?.error) {
    throw create_request_error(
      resolve_error_message(payload, 'We could not remove that Listen Later episode.'),
      response.status,
    );
  }

  return true;
}

function resolve_error_message(payload = null, fallback = '') {
  return `${payload?.error_description || payload?.error || fallback}`.trim() || fallback;
}

function create_request_error(message, status = null) {
  const error = new Error(message);
  error.status = status;
  return error;
}
