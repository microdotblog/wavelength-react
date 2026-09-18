const { build_narrate_html, is_narrate_preview_document_url } = require('../narrate_html');

describe('build_narrate_html', () => {
  test('strips audio tags and includes the title', () => {
    const html = build_narrate_html({
      background_color: '#fffaf0',
      content: '<audio src="https://micro.blog/read.m4a" style="display: none"></audio><p>Hello <strong>there</strong></p>',
      ink_color: '#24180d',
      ink_soft_color: '#756657',
      is_dark: false,
      title: 'A walk',
    });

    expect(html).toContain('<h1>A walk</h1>');
    expect(html).toContain('<p>Hello <strong>there</strong></p>');
    expect(html).not.toContain('<audio');
    expect(html).toContain('#fffaf0');
    expect(html).toContain('max-width: 100%');
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
    expect(html).toContain('<p>Body</p>');
  });

  test('is_narrate_preview_document_url allows the initial document only', () => {
    expect(is_narrate_preview_document_url('about:blank')).toBe(true);
    expect(is_narrate_preview_document_url('data:text/html;charset=utf-8,')).toBe(true);
    expect(is_narrate_preview_document_url('https://example.micro.blog/linked')).toBe(false);
  });
});
