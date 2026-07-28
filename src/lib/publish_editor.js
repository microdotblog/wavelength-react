export const DEFAULT_MAX_POST_LENGTH = 280;

const FORMAT_MARKERS = {
  bold: { after: '**', before: '**' },
  italic: { after: '_', before: '_' },
  link: { after: '](url)', before: '[' },
  quote: { after: '', before: '> ' },
};

export function clamp_selection(value = 0, min = 0, max = 0) {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
}

export function should_show_title({
  show_title = false,
  title = '',
  content_length = 0,
  max_length = DEFAULT_MAX_POST_LENGTH,
} = {}) {
  return show_title || content_length > max_length || `${title || ''}`.length > 0;
}

export function post_text_length(content = '') {
  return `${content || ''}`.length;
}

export function build_episode_audio_filename(title = '') {
  const filename = `${title || ''}`
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return filename ? `${filename}.mp3` : 'exported.mp3';
}

export function toggle_list_item(items = [], value = '') {
  const safe_items = Array.isArray(items) ? [...items] : [];
  const index = safe_items.indexOf(value);

  if (index === -1) {
    safe_items.push(value);
    return safe_items;
  }

  safe_items.splice(index, 1);
  return safe_items;
}

export function apply_text_format_action(
  text = '',
  selection = { end: 0, start: 0 },
  action = 'bold',
) {
  const safe_text = `${text || ''}`;
  const start = clamp_selection(selection?.start ?? 0, 0, safe_text.length);
  const end = clamp_selection(selection?.end ?? 0, 0, safe_text.length);
  const range_start = Math.min(start, end);
  const range_end = Math.max(start, end);
  const selected_text = safe_text.slice(range_start, range_end);
  const markers = FORMAT_MARKERS[action] || FORMAT_MARKERS.bold;

  if (action === 'quote') {
    const quoted = selected_text
      ? selected_text
        .split('\n')
        .map(line => `${markers.before}${line}`)
        .join('\n')
      : markers.before;
    const next_text = `${safe_text.slice(0, range_start)}${quoted}${safe_text.slice(range_end)}`;
    const cursor = range_start + quoted.length;

    return {
      selection: { end: cursor, start: cursor },
      text: next_text,
    };
  }

  const wrapped = `${markers.before}${selected_text}${markers.after}`;
  const next_text = `${safe_text.slice(0, range_start)}${wrapped}${safe_text.slice(range_end)}`;
  const cursor = range_start + wrapped.length;

  return {
    selection: { end: cursor, start: cursor },
    text: next_text,
  };
}

export function build_episode_publish_payload({
  audio_url = '',
  categories = [],
  content = '',
  destination = '',
  status = 'published',
  summary = '',
  syndicates = [],
  title = '',
} = {}) {
  const trimmed_title = `${title || ''}`.trim();
  const trimmed_content = `${content || ''}`.trim();
  const trimmed_summary = `${summary || ''}`.trim();
  const trimmed_status = `${status || ''}`.trim() || 'published';
  const trimmed_destination = `${destination || ''}`.trim();
  const trimmed_audio_url = `${audio_url || ''}`.trim();
  const safe_categories = Array.isArray(categories)
    ? categories.map(category => `${category || ''}`.trim()).filter(Boolean)
    : [];
  const safe_syndicates = Array.isArray(syndicates)
    ? syndicates.map(syndicate => `${syndicate || ''}`.trim()).filter(Boolean)
    : [];

  return {
    audio_url: trimmed_audio_url,
    categories: safe_categories,
    content: trimmed_content,
    destination: trimmed_destination,
    status: trimmed_status,
    summary: trimmed_summary,
    syndicates: safe_syndicates,
    title: trimmed_title,
  };
}

export function resolve_playback_toggle_action(is_playing = false) {
  return is_playing ? 'pause' : 'play';
}

export function resolve_publish_progress(phase = 'idle') {
  switch (`${phase || ''}`.trim()) {
    case 'exporting':
      return 0.25;
    case 'uploading':
      return 0.6;
    case 'posting':
      return 0.9;
    case 'done':
      return 1;
    default:
      return 0;
  }
}

export function seek_seconds_from_fraction(fraction = 0, duration_seconds = 0) {
  const basis = Math.max(duration_seconds, 0);
  const safe_fraction = Math.min(Math.max(fraction, 0), 1);

  return safe_fraction * basis;
}

export function normalize_micropub_categories(payload = null) {
  if (Array.isArray(payload)) {
    return payload.map(category => `${category || ''}`.trim()).filter(Boolean);
  }

  const categories = payload?.categories;

  if (!Array.isArray(categories)) {
    return [];
  }

  return categories.map(category => `${category || ''}`.trim()).filter(Boolean);
}

export function normalize_micropub_syndicates(payload = null) {
  const targets = payload?.['syndicate-to'];

  if (!Array.isArray(targets)) {
    return [];
  }

  return targets
    .map(target => ({
      name: `${target?.name || target?.uid || ''}`.trim(),
      uid: `${target?.uid || ''}`.trim(),
    }))
    .filter(target => target.uid);
}
