const AUDIO_TAG_PATTERN = /<audio\b/i;
const AUDIO_OPEN_TAG_PATTERN = /<audio\b[^>]*>/gi;
const HIDDEN_AUDIO_STYLE_PATTERN = /style\s*=\s*["'][^"']*display\s*:\s*none/i;

export function is_audio_post(content = '') {
  return AUDIO_TAG_PATTERN.test(`${content || ''}`);
}

export function is_narrated_post(content = '') {
  const tags = `${content || ''}`.match(AUDIO_OPEN_TAG_PATTERN) || [];

  return tags.some(tag => HIDDEN_AUDIO_STYLE_PATTERN.test(tag));
}

function has_visible_audio(content = '') {
  const tags = `${content || ''}`.match(AUDIO_OPEN_TAG_PATTERN) || [];

  return tags.some(tag => !HIDDEN_AUDIO_STYLE_PATTERN.test(tag));
}

export function post_kind(content = '') {
  if (has_visible_audio(content)) {
    return 'podcast';
  }

  if (is_narrated_post(content)) {
    return 'narrated';
  }

  return 'post';
}

export function post_display_title(post = {}) {
  const title = `${post?.title || ''}`.trim();

  if (title) {
    return title;
  }

  const first_line = first_plain_line(post?.content || '');

  if (first_line) {
    return first_line;
  }

  return 'Untitled';
}

function first_plain_line(content = '') {
  const html = `${content || ''}`;
  const first_block = html.split(/<\/p>|<br\s*\/?>|\n/i)[0] || html;

  return post_plain_text(first_block);
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

  if (!uid || !url) {
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
