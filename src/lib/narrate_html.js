import { strip_audio_tags } from './narration';

function escape_html(value = '') {
  return `${value || ''}`
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function is_narrate_preview_document_url(url = '') {
  const trimmed = `${url || ''}`.trim();

  if (!trimmed || trimmed === 'about:blank') {
    return true;
  }

  return trimmed.startsWith('data:text/html');
}

export function build_narrate_html({
  background_color = '#fffaf0',
  content = '',
  ink_color = '#24180d',
  ink_soft_color = '#756657',
  is_dark = false,
  title = '',
} = {}) {
  const body = strip_audio_tags(content);
  const safe_title = escape_html(`${title || ''}`.trim());
  const title_html = safe_title ? `<h1>${safe_title}</h1>` : '';
  const safe_background = escape_html(background_color);
  const safe_ink = escape_html(ink_color);
  const safe_ink_soft = escape_html(ink_soft_color);

  return `<!doctype html>
<html class="${is_dark ? 'dark' : 'light'}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
  <style>
    html, body {
      margin: 0;
      padding: 0;
      background: ${safe_background};
      color: ${safe_ink};
      font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif;
      font-size: 18px;
      line-height: 1.5;
      -webkit-text-size-adjust: 100%;
    }
    body {
      padding: 20px 20px 32px;
    }
    h1 {
      font-size: 26px;
      font-weight: 800;
      line-height: 1.25;
      margin: 0 0 16px;
    }
    .post :first-child {
      margin-top: 0;
    }
    img, video {
      max-width: 100%;
      height: auto;
    }
    a {
      color: ${safe_ink};
    }
    figcaption, .post .caption {
      color: ${safe_ink_soft};
    }
  </style>
</head>
<body>
  ${title_html}
  <div class="post">${body}</div>
</body>
</html>`;
}
