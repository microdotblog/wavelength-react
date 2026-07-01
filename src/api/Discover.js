export const MICRO_BLOG_DISCOVER_URL = 'https://micro.blog/posts/discover';
export const DISCOVER_PODCASTS_TOPIC = 'podcasts';

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

function resolve_error_message(payload = null, fallback = '') {
  return `${payload?.error_description || payload?.error || fallback}`.trim() || fallback;
}

function create_request_error(message, status = null) {
  const error = new Error(message);
  error.status = status;
  return error;
}
