const {
  format_post_date,
  is_audio_post,
  normalize_micropub_post_source,
  normalize_micropub_posts,
  post_plain_text,
  read_micropub_post_id,
} = require('../micropub_posts');

describe('micropub_posts', () => {
  test('is_audio_post detects audio markup', () => {
    expect(is_audio_post('<audio controls src="https://micro.blog/audio.m4a"></audio>')).toBe(true);
    expect(is_audio_post('<p>Show notes</p>')).toBe(false);
  });

  test('normalize_micropub_posts keeps published audio posts only', () => {
    const posts = normalize_micropub_posts({
      items: [
        {
          properties: {
            content: ['<p>Text only</p>'],
            published: ['2026-06-01T12:00:00Z'],
            uid: ['1'],
            url: ['https://example.micro.blog/1'],
          },
        },
        {
          properties: {
            content: ['<audio controls src="https://micro.blog/audio.m4a"></audio><p>Notes</p>'],
            name: ['Morning microcast'],
            published: ['2026-06-02T12:00:00Z'],
            uid: ['2'],
            url: ['https://example.micro.blog/2'],
          },
        },
        {
          properties: {
            content: ['<audio controls src="https://micro.blog/draft.m4a"></audio>'],
            'post-status': ['draft'],
            published: ['2026-06-03T12:00:00Z'],
            uid: ['3'],
            url: ['https://example.micro.blog/3'],
          },
        },
      ],
    });

    expect(posts).toHaveLength(1);
    expect(posts[0].uid).toBe('2');
    expect(posts[0].title).toBe('Morning microcast');
  });

  test('read_micropub_post_id reads uid from a source item', () => {
    expect(read_micropub_post_id({
      properties: {
        uid: ['12345'],
      },
    })).toBe('12345');
  });

  test('normalize_micropub_post_source reads editable post fields', () => {
    expect(normalize_micropub_post_source({
      properties: {
        category: ['microcast', 'notes'],
        content: ['<audio controls src="https://micro.blog/audio.m4a"></audio><p>Notes</p>'],
        name: ['Morning microcast'],
        'post-status': ['published'],
        summary: ['Short summary'],
        uid: ['12345'],
        url: ['https://example.micro.blog/post/1'],
      },
    })).toEqual({
      categories: ['microcast', 'notes'],
      content: '<audio controls src="https://micro.blog/audio.m4a"></audio><p>Notes</p>',
      post_status: 'published',
      summary: 'Short summary',
      title: 'Morning microcast',
      uid: '12345',
      url: 'https://example.micro.blog/post/1',
    });
  });

  test('post_plain_text strips markup', () => {
    expect(post_plain_text('<p>Hello <strong>world</strong></p>')).toBe('Hello world');
  });

  test('format_post_date returns a readable label', () => {
    expect(format_post_date('2026-06-02T12:00:00Z')).toMatch(/Jun/);
  });
});
