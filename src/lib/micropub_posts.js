const AUDIO_TAG_PATTERN = /<audio\b/i;

export function is_audio_post(content = '') {
  return AUDIO_TAG_PATTERN.test(`${content || ''}`);
}

function read_micropub_property(properties = {}, name = '') {
  const value = properties?.[name];

  if (Array.isArray(value)) {
    return `${value[0] || ''}`.trim();
  }

  return `${value || ''}`.trim();
}

function read_micropub_property_array(properties = {}, name = '') {
  const value = properties?.[name];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(entry => `${entry || ''}`.trim()).filter(Boolean);
}

export function read_micropub_post_id(source_item = null) {
  return read_micropub_property(source_item?.properties || {}, 'uid');
}

export function normalize_micropub_post_source(payload = null) {
  const properties = payload?.properties || {};

  return {
    categories: read_micropub_property_array(properties, 'category'),
    content: read_micropub_property(properties, 'content'),
    post_status: read_micropub_property(properties, 'post-status') || 'published',
    summary: read_micropub_property(properties, 'summary'),
    title: read_micropub_property(properties, 'name'),
    uid: read_micropub_post_id(payload),
    url: read_micropub_property(properties, 'url'),
  };
}

function normalize_micropub_post_item(item = null) {
  const properties = item?.properties || {};
  const uid = read_micropub_post_id(item);
  const url = read_micropub_property(properties, 'url');
  const content = read_micropub_property(properties, 'content');
  const post_status = read_micropub_property(properties, 'post-status') || 'published';

  if (!uid || !url || !is_audio_post(content)) {
    return null;
  }

  if (post_status === 'draft') {
    return null;
  }

  return {
    content,
    post_status,
    published_at: read_micropub_property(properties, 'published'),
    title: read_micropub_property(properties, 'name'),
    uid,
    url,
  };
}

export function normalize_micropub_posts(payload = null) {
  const items = Array.isArray(payload?.items) ? payload.items : [];

  return items
    .map(normalize_micropub_post_item)
    .filter(Boolean)
    .sort((first, second) => second.published_at.localeCompare(first.published_at));
}

export function format_post_date(iso_string = '') {
  const date = new Date(`${iso_string || ''}`);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString(undefined, {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function post_plain_text(content = '') {
  return `${content || ''}`
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
