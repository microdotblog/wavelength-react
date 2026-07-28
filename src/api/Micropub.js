import { File, UploadType } from 'expo-file-system';

import { normalize_micropub_post_source, read_micropub_post_id } from '../lib/micropub_posts';

export const MICRO_BLOG_MICROPUB_URL = 'https://micro.blog/micropub';
export const MICRO_BLOG_MEDIA_URL = 'https://micro.blog/micropub/media';

const DEFAULT_AUDIO_MIME = 'audio/mp4';
const MP3_AUDIO_MIME = 'audio/mpeg';

export function resolve_audio_mime_type(file_uri = '') {
  const normalized_uri = `${file_uri || ''}`.trim().toLowerCase();

  if (normalized_uri.endsWith('.mp3')) {
    return MP3_AUDIO_MIME;
  }

  return DEFAULT_AUDIO_MIME;
}

// Micro.blog returns the uploaded/published URL in the Location header and
// echoes it in the JSON body. Prefer the header, fall back to the body.
export function resolve_uploaded_url(location_header = '', json_body = null) {
  const header_url = `${location_header || ''}`.trim();

  if (header_url) {
    return header_url;
  }

  return `${json_body?.url || ''}`.trim();
}

export async function upload_episode_audio({
  token = '',
  destination = '',
  file_name = '',
  file_uri = '',
} = {}) {
  const trimmed_token = `${token || ''}`.trim();
  const trimmed_uri = `${file_uri || ''}`.trim();

  if (!trimmed_token) {
    throw create_request_error('You need to be signed in to Micro.blog to publish.');
  }

  if (!trimmed_uri) {
    throw create_request_error('This episode has no audio to upload.');
  }

  const audio_file = new File(trimmed_uri);

  if (!audio_file.exists) {
    throw create_request_error('This episode has no audio to upload.');
  }

  const trimmed_destination = `${destination || ''}`.trim();
  const parameters = trimmed_destination ? { 'mp-destination': trimmed_destination } : undefined;
  const trimmed_file_name = `${file_name || ''}`.trim();
  let upload_file = audio_file;

  try {
    if (trimmed_file_name && trimmed_file_name !== audio_file.name) {
      upload_file = new File(audio_file.parentDirectory, trimmed_file_name);
      await audio_file.copy(upload_file, { overwrite: true });
    }

    // ponytail: native multipart upload avoids Expo fetch's unsupported { uri } FormData parts.
    const response = await upload_file.upload(MICRO_BLOG_MEDIA_URL, {
      fieldName: 'file',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${trimmed_token}`,
      },
      mimeType: resolve_audio_mime_type(upload_file.uri || trimmed_uri),
      parameters,
      uploadType: UploadType.MULTIPART,
    });
    const payload = parse_json_body(response.body);

    if (response.status < 200 || response.status >= 300 || payload?.error) {
      throw create_request_error(
        resolve_error_message(payload, 'We could not upload the episode audio.'),
        response.status,
      );
    }

    const audio_url = resolve_uploaded_url(resolve_response_header(response.headers, 'Location'), payload);

    if (!audio_url) {
      throw create_request_error('Micro.blog did not return an audio URL.');
    }

    return audio_url;
  } finally {
    if (upload_file !== audio_file && upload_file.exists) {
      upload_file.delete();
    }
  }
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

export async function fetch_micropub_config({ token = '' } = {}) {
  const payload = await fetch_micropub_query({ query: 'config', token });

  if (!payload) {
    throw create_request_error('We could not load your blogs.');
  }

  return payload;
}

export async function fetch_micropub_syndicate_targets({ token = '', destination = '' } = {}) {
  return fetch_micropub_query({ destination, query: 'syndicate-to', token });
}

export async function fetch_micropub_posts({ token = '', destination = '' } = {}) {
  return fetch_micropub_query({ destination, query: 'source', token });
}

export async function fetch_micropub_post_source({ token = '', destination = '', post_url = '' } = {}) {
  const payload = await fetch_micropub_post_source_payload({ destination, post_url, token });

  if (!payload) {
    return null;
  }

  return normalize_micropub_post_source(payload);
}

export async function fetch_micropub_post_id({ token = '', destination = '', post_url = '' } = {}) {
  const payload = await fetch_micropub_post_source_payload({ destination, post_url, token });

  if (!payload) {
    return '';
  }

  return read_micropub_post_id(payload);
}

export async function update_micropub_post({
  token = '',
  destination = '',
  post_url = '',
  title = '',
  content = '',
  status = 'published',
  categories = [],
  summary = '',
} = {}) {
  const trimmed_token = `${token || ''}`.trim();
  const trimmed_post_url = `${post_url || ''}`.trim();

  if (!trimmed_token) {
    throw create_request_error('You need to be signed in to Micro.blog to update a post.');
  }

  if (!trimmed_post_url) {
    throw create_request_error('A post URL is required to update this post.');
  }

  const trimmed_destination = `${destination || ''}`.trim();
  const safe_categories = Array.isArray(categories)
    ? categories.map(category => `${category || ''}`.trim()).filter(Boolean)
    : [];
  const replace = {
    category: safe_categories,
    content: [`${content || ''}`],
    name: [`${title || ''}`],
    'post-status': [`${status || 'published'}`.trim() || 'published'],
  };
  const trimmed_summary = `${summary || ''}`.trim();

  if (trimmed_summary) {
    replace.summary = [trimmed_summary];
  }

  const body = {
    action: 'update',
    replace,
    url: trimmed_post_url,
  };

  if (trimmed_destination) {
    body['mp-destination'] = trimmed_destination;
  }

  const response = await fetch(MICRO_BLOG_MICROPUB_URL, {
    body: JSON.stringify(body),
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${trimmed_token}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload?.error) {
    throw create_request_error(
      resolve_error_message(payload, 'We could not update the post.'),
      response.status,
    );
  }

  return true;
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

export async function delete_micropub_post({ token = '', destination = '', post_url = '' } = {}) {
  const trimmed_token = `${token || ''}`.trim();
  const trimmed_post_url = `${post_url || ''}`.trim();

  if (!trimmed_token) {
    throw create_request_error('You need to be signed in to Micro.blog to delete a post.');
  }

  if (!trimmed_post_url) {
    throw create_request_error('A post URL is required to delete the published post.');
  }

  const body = new URLSearchParams({
    action: 'delete',
    url: trimmed_post_url,
  });

  const trimmed_destination = `${destination || ''}`.trim();

  if (trimmed_destination) {
    body.append('mp-destination', trimmed_destination);
  }

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
      resolve_error_message(payload, 'We could not delete the published post.'),
      response.status,
    );
  }

  return true;
}

async function fetch_micropub_post_source_payload({ token = '', destination = '', post_url = '' } = {}) {
  const trimmed_token = `${token || ''}`.trim();
  const trimmed_post_url = `${post_url || ''}`.trim();

  if (!trimmed_token || !trimmed_post_url) {
    return null;
  }

  const url = new URL(MICRO_BLOG_MICROPUB_URL);
  url.searchParams.set('q', 'source');
  url.searchParams.set('url', trimmed_post_url);

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

function parse_json_body(body = '') {
  try {
    return JSON.parse(`${body || ''}`) || {};
  } catch {
    return {};
  }
}

function resolve_error_message(payload = null, fallback = '') {
  return `${payload?.error_description || payload?.error || fallback}`.trim() || fallback;
}

function resolve_response_header(headers = {}, name = '') {
  const target = `${name || ''}`.toLowerCase();

  for (const [key, value] of Object.entries(headers)) {
    if (`${key || ''}`.toLowerCase() === target) {
      return `${value || ''}`.trim();
    }
  }

  return '';
}

function create_request_error(message, status = null) {
  const error = new Error(message);
  error.status = status;
  return error;
}
