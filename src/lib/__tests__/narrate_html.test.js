const { build_narrate_html, is_narrate_preview_document_url } = require('../narrate_html');

describe('build_narrate_html', () => {
  test('strips HTML and audio tags and includes the title', () => {
    const html = build_narrate_html({
      background_color: '#fffaf0',
      content: '<audio src="https://micro.blog/read.m4a" style="display: none"></audio><p>Hello <strong>there</strong></p>',
      ink_color: '#24180d',
      ink_soft_color: '#756657',
      is_dark: false,
      title: 'A walk',
    });

    expect(html).toContain('<h1>A walk</h1>');
    expect(html).toContain('<div class="post">Hello there</div>');
    expect(html).not.toContain('<audio');
    expect(html).toContain('#fffaf0');
    expect(html).toContain('white-space: pre-wrap');
  });

  test('escapes title markup', () => {
    const html = build_narrate_html({
      content: '<p>Body</p>',
      title: '<script>alert(1)</script>',
    });

    expect(html).toContain('<h1>&lt;script&gt;alert(1)&lt;/script&gt;</h1>');
    expect(html).not.toContain('<h1><script>');
  });

  test('omits the heading when there is no title', () => {
    const html = build_narrate_html({
      content: '<p>Body</p>',
      title: '',
    });

    expect(html).not.toContain('<h1>');
    expect(html).toContain('<div class="post">Body</div>');
  });

  test('renders Markdown as plain text with paragraph and list breaks', () => {
    const html = build_narrate_html({
      content: '# A heading\n\nHello **there** and [a friend](https://example.com).\n\n- First\n- *Second*',
    });

    expect(html).toContain('<div class="post">A heading\n\nHello there and a friend.\n\nFirst\n\nSecond</div>');
    expect(html).not.toContain('https://example.com');
    expect(html).not.toContain('<strong>');
  });

  test('preserves HTML paragraph breaks, line breaks, and encoded text', () => {
    const html = build_narrate_html({
      content: '<p>One &amp; two<br>Next line</p><p>Three &lt; four</p>',
    });

    expect(html).toContain('<div class="post">One &amp; two\nNext line\n\nThree &lt; four</div>');
  });

  test('omits images, comments, scripts, and styles from narration', () => {
    const html = build_narrate_html({
      content: 'Hello ![Photo](https://example.com/image.jpg)\n\n<!-- hidden -->\n<script>alert(1)</script>\n<style>p { color: red; }</style>',
    });

    expect(html).toContain('<div class="post">Hello</div>');
    expect(html).not.toContain('image.jpg');
    expect(html).not.toContain('alert(1)');
  });

  test('removes tag attributes while preserving literal code as text', () => {
    const html = build_narrate_html({
      content: 'Read <a title="1 > 0" href="https://example.com">this</a> and `<b>code</b>`.',
    });

    expect(html).toContain('<div class="post">Read this and &lt;b&gt;code&lt;/b&gt;.</div>');
  });

  test('is_narrate_preview_document_url allows the initial document only', () => {
    expect(is_narrate_preview_document_url('about:blank')).toBe(true);
    expect(is_narrate_preview_document_url('data:text/html;charset=utf-8,')).toBe(true);
    expect(is_narrate_preview_document_url('https://example.micro.blog/linked')).toBe(false);
  });
});
