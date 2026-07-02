const CDN_AVATAR_PATTERN = /cdn\.micro\.blog\/photos\/\d+\/(.+)$/i;

export function resolve_discover_avatar_url(avatar_url = '') {
  const trimmed_avatar_url = `${avatar_url || ''}`.trim();

  if (!trimmed_avatar_url) {
    return '';
  }

  const cdn_match = trimmed_avatar_url.match(CDN_AVATAR_PATTERN);

  if (!cdn_match?.[1]) {
    return trimmed_avatar_url;
  }

  try {
    return decodeURIComponent(cdn_match[1]).trim() || trimmed_avatar_url;
  } catch {
    return trimmed_avatar_url;
  }
}

function normalize_entry_text(value = '') {
  return `${value || ''}`.replace(/\s+/g, ' ').trim();
}

function decode_html_entities(value = '') {
  return `${value || ''}`.replace(
    /&(#x[0-9a-f]+|#\d+|amp|apos|gt|lt|nbsp|quot);/gi,
    (match, entity) => {
      const normalized_entity = `${entity || ''}`.toLowerCase();

      if (normalized_entity === 'amp') {
        return '&';
      } else if (normalized_entity === 'apos') {
        return "'";
      } else if (normalized_entity === 'gt') {
        return '>';
      } else if (normalized_entity === 'lt') {
        return '<';
      } else if (normalized_entity === 'nbsp') {
        return ' ';
      } else if (normalized_entity === 'quot') {
        return '"';
      } else if (normalized_entity.startsWith('#x')) {
        const code_point = Number.parseInt(normalized_entity.slice(2), 16);

        if (Number.isInteger(code_point)) {
          return String.fromCodePoint(code_point);
        }
      } else if (normalized_entity.startsWith('#')) {
        const code_point = Number.parseInt(normalized_entity.slice(1), 10);

        if (Number.isInteger(code_point)) {
          return String.fromCodePoint(code_point);
        }
      }

      return match;
    },
  );
}

function extract_preview_text(content = '') {
  const html = `${content || ''}`.trim();

  if (!html) {
    return '';
  }

  const text = decode_html_entities(
    html
      .replace(/<\s*br\s*\/?>/gi, ' ')
      .replace(/<\s*\/\s*p\s*>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );

  if (text.length <= 280) {
    return text;
  } else {
    return `${text.slice(0, 277).trimEnd()}...`;
  }
}

const TRAILING_LINK_LABEL_PATTERN =
  /\s*:\s*[\w.-]+\.(com|blog|org|net|io|co|dev|app|micro\.blog)\/?\s*$/i;

export function extract_discover_title(content_html = '') {
  const preview = extract_preview_text(content_html);

  if (!preview) {
    return '';
  }

  const title = preview.replace(TRAILING_LINK_LABEL_PATTERN, '').trim();

  if (title) {
    return title;
  } else {
    return preview;
  }
}

export function format_discover_timestamp(raw_date = '') {
  if (!raw_date) {
    return '';
  }

  const date = new Date(raw_date);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const date_part = date.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
  });
  const time_part = date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

  if (!date_part) {
    return time_part;
  } else if (!time_part) {
    return date_part;
  } else {
    return `${date_part}, ${time_part}`;
  }
}

export function resolve_discover_post_content(post = null) {
  const source_label = normalize_entry_text(post?.author_name) || 'Micro.blog';
  const title = normalize_entry_text(post?.title);
  const display_title = title || source_label;
  const summary_text = normalize_entry_text(post?.summary);
  let summary = '';

  if (summary_text && summary_text !== title) {
    summary = summary_text;
  }

  const timestamp =
    normalize_entry_text(post?.date_relative) ||
    format_discover_timestamp(post?.published_at);

  return {
    display_title,
    secondary_source_label: title ? source_label : '',
    source_label,
    summary,
    timestamp,
  };
}

function normalize_discover_audio(item = null) {
  const audio = item?._microblog?.audio;

  if (!audio || typeof audio !== 'object') {
    return {
      audio_url: '',
      duration_display: '',
      duration_seconds: 0,
    };
  }

  const duration_seconds = Number.parseInt(`${audio.duration_seconds ?? ''}`, 10);

  return {
    audio_url: `${audio.url || ''}`.trim(),
    duration_display: `${audio.duration_display || ''}`.trim(),
    duration_seconds: Number.isFinite(duration_seconds) && duration_seconds > 0
      ? duration_seconds
      : 0,
  };
}

export function is_playable_discover_post(post = null) {
  return `${post?.audio_url || ''}`.trim().length > 0;
}

function normalize_discover_post_item(item = null) {
  const id = `${item?.id || ''}`.trim();
  const url = `${item?.url || ''}`.trim();

  if (!id || !url) {
    return null;
  }

  const content_html = `${item?.content_html || ''}`.trim();
  const title = extract_discover_title(content_html);
  const audio = normalize_discover_audio(item);

  return {
    author_avatar: resolve_discover_avatar_url(item?.author?.avatar),
    author_name: `${item?.author?.name || ''}`.trim(),
    author_url: `${item?.author?.url || ''}`.trim(),
    author_username: `${item?.author?._microblog?.username || ''}`.trim(),
    audio_url: audio.audio_url,
    date_relative: `${item?._microblog?.date_relative || ''}`.trim(),
    duration_display: audio.duration_display,
    duration_seconds: audio.duration_seconds,
    id,
    is_podcast: item?._microblog?.is_podcast === true,
    published_at: `${item?.date_published || ''}`.trim(),
    summary: normalize_entry_text(item?.summary),
    title,
    url,
  };
}

export function normalize_discover_posts(payload = null) {
  const items = Array.isArray(payload?.items) ? payload.items : [];

  return items.map(normalize_discover_post_item).filter(Boolean);
}
