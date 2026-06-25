export const MICRO_BLOG_MICROPUB_URL = 'https://micro.blog/micropub';
export const MICRO_BLOG_MEDIA_URL = 'https://micro.blog/micropub/media';

const DEFAULT_AUDIO_FILENAME = 'episode.m4a';
const DEFAULT_AUDIO_MIME = 'audio/mp4';

// Micro.blog returns the uploaded/published URL in the Location header and
// echoes it in the JSON body. Prefer the header, fall back to the body.
export function resolve_uploaded_url(location_header = '', json_body = null) {
  const header_url = `${location_header || ''}`.trim();

  if (header_url) {
    return header_url;
  }

  return `${json_body?.url || ''}`.trim();
}

export async function upload_episode_audio({ token = '', destination = '', file_uri = '' } = {}) {
  const trimmed_token = `${token || ''}`.trim();
  const trimmed_uri = `${file_uri || ''}`.trim();

  if (!trimmed_token) {
    throw create_request_error('You need to be signed in to Micro.blog to publish.');
  }

  if (!trimmed_uri) {
    throw create_request_error('This episode has no audio to upload.');
  }

  const form = new FormData();
  form.append('file', {
    name: DEFAULT_AUDIO_FILENAME,
    type: DEFAULT_AUDIO_MIME,
    uri: trimmed_uri,
  });

  const trimmed_destination = `${destination || ''}`.trim();

  if (trimmed_destination) {
    form.append('mp-destination', trimmed_destination);
  }

  const response = await fetch(MICRO_BLOG_MEDIA_URL, {
    body: form,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${trimmed_token}`,
    },
    method: 'POST',
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload?.error) {
    throw create_request_error(
      resolve_error_message(payload, 'We could not upload the episode audio.'),
      response.status,
    );
  }

  const audio_url = resolve_uploaded_url(response.headers.get('Location'), payload);

  if (!audio_url) {
    throw create_request_error('Micro.blog did not return an audio URL.');
  }

  return audio_url;
}

export function build_episode_post_body({
  audio_url = '',
  categories = [],
  content = '',
  destination = '',
  status = 'published',
  summary = '',
  syndicates = [],
  title = '',
} = {}) {
  const body = new URLSearchParams({
    audio: `${audio_url || ''}`.trim(),
    content: `${content || ''}`,
    h: 'entry',
    name: `${title || ''}`,
  });

  const trimmed_destination = `${destination || ''}`.trim();

  if (trimmed_destination) {
    body.append('mp-destination', trimmed_destination);
  }

  const trimmed_status = `${status || ''}`.trim();

  if (trimmed_status) {
    body.append('post-status', trimmed_status);
  }

  const trimmed_summary = `${summary || ''}`.trim();

  if (trimmed_summary) {
    body.append('summary', trimmed_summary);
  }

  const safe_categories = Array.isArray(categories)
    ? categories.map(category => `${category || ''}`.trim()).filter(Boolean)
    : [];

  for (const category of safe_categories) {
    body.append('category[]', category);
  }

  const safe_syndicates = Array.isArray(syndicates)
    ? syndicates.map(syndicate => `${syndicate || ''}`.trim()).filter(Boolean)
    : [];

  for (const syndicate of safe_syndicates) {
    body.append('mp-syndicate-to[]', syndicate);
  }

  return body;
}

export async function fetch_micropub_categories({ token = '', destination = '' } = {}) {
  return fetch_micropub_query({ destination, query: 'category', token });
}

export async function fetch_micropub_syndicate_targets({ token = '', destination = '' } = {}) {
  return fetch_micropub_query({ destination, query: 'syndicate-to', token });
}

export async function create_episode_post({
  token = '',
  destination = '',
  title = '',
  content = '',
  audio_url = '',
  status = 'published',
  categories = [],
  summary = '',
  syndicates = [],
} = {}) {
  const trimmed_token = `${token || ''}`.trim();
  const trimmed_audio_url = `${audio_url || ''}`.trim();

  if (!trimmed_token) {
    throw create_request_error('You need to be signed in to Micro.blog to publish.');
  }

  if (!trimmed_audio_url) {
    throw create_request_error('The episode audio must be uploaded before posting.');
  }

  const body = build_episode_post_body({
    audio_url: trimmed_audio_url,
    categories,
    content,
    destination,
    status,
    summary,
    syndicates,
    title,
  });

  const response = await fetch(MICRO_BLOG_MICROPUB_URL, {
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
      resolve_error_message(payload, 'We could not publish the episode.'),
      response.status,
    );
  }

  return resolve_uploaded_url(response.headers.get('Location'), payload);
}

async function fetch_micropub_query({ token = '', destination = '', query = '' } = {}) {
  const trimmed_token = `${token || ''}`.trim();
  const trimmed_query = `${query || ''}`.trim();

  if (!trimmed_token || !trimmed_query) {
    return null;
  }

  const url = new URL(MICRO_BLOG_MICROPUB_URL);
  url.searchParams.set('q', trimmed_query);

  const trimmed_destination = `${destination || ''}`.trim();

  if (trimmed_destination) {
    url.searchParams.set('mp-destination', trimmed_destination);
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
    return null;
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
