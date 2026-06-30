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

export function read_micropub_post_id(source_item = null) {
  const properties = source_item?.properties || {};
  const value = properties?.uid;

  if (Array.isArray(value)) {
    return `${value[0] || ''}`.trim();
  }

  return `${value || ''}`.trim();
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
