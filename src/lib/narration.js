const AUDIO_ELEMENT_PATTERN = /<audio\b[^>]*\/?>(?:\s*<\/audio>)?/gi;
const HIDDEN_AUDIO_STYLE_PATTERN = /style\s*=\s*["'][^"']*display\s*:\s*none/i;
const AUDIO_SRC_PATTERN = /\bsrc\s*=\s*["']([^"']+)["']/i;

export function build_narration_audio_tag(audio_url = '') {
  const url = `${audio_url || ''}`.trim();

  return `<audio src="${url}" preload="metadata" style="display: none"></audio>`;
}

export function strip_audio_tags(content = '') {
  return `${content || ''}`.replace(AUDIO_ELEMENT_PATTERN, '').trim();
}

export function strip_hidden_audio_tags(content = '') {
  return `${content || ''}`.replace(AUDIO_ELEMENT_PATTERN, (tag) => {
    if (HIDDEN_AUDIO_STYLE_PATTERN.test(tag)) {
      return '';
    }

    return tag;
  }).trim();
}

export function read_narration_audio_url(content = '') {
  const html = `${content || ''}`;
  const tags = html.match(AUDIO_ELEMENT_PATTERN) || [];
  const hidden_tag = tags.find(tag => HIDDEN_AUDIO_STYLE_PATTERN.test(tag)) || '';
  const src = hidden_tag.match(AUDIO_SRC_PATTERN)?.[1] || '';

  return `${src}`.trim();
}

export function apply_narration_html(content = '', audio_url = '') {
  const url = `${audio_url || ''}`.trim();
  const body = strip_hidden_audio_tags(content);

  if (!url) {
    return body;
  }

  if (!body) {
    return build_narration_audio_tag(url);
  }

  return `${build_narration_audio_tag(url)}\n${body}`;
}
