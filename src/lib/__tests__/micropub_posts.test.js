const {
  format_post_date,
  is_audio_post,
  normalize_micropub_post_source,
  normalize_micropub_posts,
  post_display_summary,
  post_display_title,
  post_kind,
  post_kind_icon,
  post_kind_label,
  post_plain_text,
  read_micropub_post_id,
} = require('../micropub_posts');

describe('micropub_posts', () => {
  test('is_audio_post detects audio markup', () => {
    expect(is_audio_post('<audio controls src="https://micro.blog/audio.m4a"></audio>')).toBe(true);
    expect(is_audio_post('<p>Show notes</p>')).toBe(false);
  });

  test('normalize_micropub_posts keeps published posts of every kind', () => {
    const posts = normalize_micropub_posts({
      items: [
        {
          properties: {
            content: ['<p>Just text</p>'],
            name: ['A note'],
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
            summary: ['A walk around the lake'],
            uid: ['2'],
            url: ['https://example.micro.blog/2'],
          },
        },
        {
          properties: {
            content: ['<audio src="https://micro.blog/read.m4a" preload="metadata" style="display: none"></audio><p>Essay</p>'],
            name: ['Essay'],
            published: ['2026-06-03T12:00:00Z'],
            uid: ['3'],
            url: ['https://example.micro.blog/3'],
          },
        },
        {
          properties: {
            content: ['<p>Draft</p>'],
            'post-status': ['draft'],
            uid: ['4'],
            url: ['https://example.micro.blog/4'],
          },
        },
      ],
    });

    expect(posts.map(post => post.uid)).toEqual(['3', '2', '1']);
    expect(posts.find(post => post.uid === '2').summary).toBe('A walk around the lake');
    expect(posts.find(post => post.uid === '1').summary).toBe('');
  });

  test('post_kind classifies visible audio, hidden audio, and text', () => {
    expect(post_kind('<p>Hello</p>')).toBe('post');
    expect(post_kind('<audio controls src="https://micro.blog/a.m4a"></audio>')).toBe('podcast');
    expect(post_kind('<audio src="https://micro.blog/a.m4a" preload="metadata" style="display: none"></audio><p>Hi</p>')).toBe('narrated');
    expect(post_kind('<audio controls="controls" src="https://micro.blog/a.m4a" preload="metadata" style="display: none;"></audio>')).toBe('narrated');
  });

  test('post_kind_label and post_kind_icon mark podcasts and narrations', () => {
    expect(post_kind_label('podcast')).toBe('Podcast');
    expect(post_kind_icon('podcast')).toBe('waveform');
    expect(post_kind_label('narrated')).toBe('Narrated');
    expect(post_kind_icon('narrated')).toBe('microphone');
    expect(post_kind_label('post')).toBe('');
    expect(post_kind_icon('post')).toBe('');
  });

  test('post_kind treats visible audio as a podcast even if a hidden tag is also present', () => {
    expect(post_kind(
      '<audio controls src="https://micro.blog/show.m4a"></audio><audio src="https://micro.blog/read.m4a" style="display: none"></audio>',
    )).toBe('podcast');
  });

  test('post_display_title prefers name, then first line of text, then Untitled', () => {
    expect(post_display_title({ title: 'Named', content: '<p>Body</p>' })).toBe('Named');
    expect(post_display_title({ title: '', content: '<p>First line of the post</p>' })).toBe('First line of the post');
    expect(post_display_title({
      title: '',
      content: '<p>First paragraph.</p><p>Second paragraph that should not appear.</p>',
    })).toBe('First paragraph.');
    expect(post_display_title({ title: '', content: '' })).toBe('Untitled');
  });

  test('post_display_summary prefers the post summary, then body text', () => {
    expect(post_display_summary({
      content: '<audio controls src="https://micro.blog/a.m4a"></audio>',
      summary: 'Show notes for the episode',
      title: 'Morning microcast',
    })).toBe('Show notes for the episode');
    expect(post_display_summary({
      content: '<audio controls src="https://micro.blog/a.m4a"></audio><p>Notes in the body</p>',
      summary: '',
      title: 'Morning microcast',
    })).toBe('Notes in the body');
    expect(post_display_summary({
      content: '<p>A walk around the lake</p>',
      summary: 'A walk around the lake',
      title: '',
    })).toBe('');
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
