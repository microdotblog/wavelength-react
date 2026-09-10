const {
  apply_narration_html,
  read_narration_audio_url,
  strip_audio_tags,
} = require('../narration');

describe('narration html', () => {
  test('apply_narration_html prepends a hidden audio tag', () => {
    expect(apply_narration_html('<p>Hello</p>', 'https://micro.blog/read.m4a')).toBe(
      '<audio src="https://micro.blog/read.m4a" preload="metadata" style="display: none"></audio>\n<p>Hello</p>',
    );
  });

  test('apply_narration_html replaces an existing hidden tag and leaves the body', () => {
    const content = '<audio src="https://micro.blog/old.m4a" preload="metadata" style="display: none"></audio>\n<p>Hello</p>';

    expect(apply_narration_html(content, 'https://micro.blog/new.m4a')).toBe(
      '<audio src="https://micro.blog/new.m4a" preload="metadata" style="display: none"></audio>\n<p>Hello</p>',
    );
  });

  test('apply_narration_html also replaces the server-generated controls+hidden form', () => {
    const content = '<audio controls="controls" src="https://micro.blog/old.m4a" preload="metadata" style="display: none;"></audio><p>Hello</p>';

    expect(apply_narration_html(content, 'https://micro.blog/new.m4a')).toContain('src="https://micro.blog/new.m4a"');
    expect(apply_narration_html(content, 'https://micro.blog/new.m4a')).not.toContain('old.m4a');
  });

  test('read_narration_audio_url returns the hidden src', () => {
    expect(read_narration_audio_url(
      '<audio src="https://micro.blog/read.m4a" preload="metadata" style="display: none"></audio><p>Hi</p>',
    )).toBe('https://micro.blog/read.m4a');
    expect(read_narration_audio_url('<p>Hi</p>')).toBe('');
  });

  test('strip_audio_tags removes audio elements for the read-only preview', () => {
    expect(strip_audio_tags(
      '<audio src="https://micro.blog/read.m4a" style="display: none"></audio><p>Hello <strong>there</strong></p>',
    )).toBe('<p>Hello <strong>there</strong></p>');
  });
});
