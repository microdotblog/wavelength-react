const {
  extract_discover_title,
  format_discover_timestamp,
  is_playable_discover_post,
  normalize_discover_posts,
  resolve_discover_avatar_url,
  resolve_discover_post_content,
} = require('../discover_posts');

describe('discover_posts', () => {
  test('normalize_discover_posts maps JSON Feed items from the live API shape', () => {
    expect(
      normalize_discover_posts({
        items: [
          {
            author: {
              avatar: 'https://cdn.micro.blog/photos/96/https%3A%2F%2Favatars.micro.blog%2Favatars%2F2024%2F49%2F83234.jpg',
              name: 'John Arthur Nichol',
              url: 'https://johnarthurnichol.com',
              _microblog: {
                username: 'JohnAN',
              },
            },
            content_html:
              '<p>Sascha Martin\'s Ripping News, the Podcast: Teaser 3: <a href="https://johnarthurnichol.com/2026/07/01/sascha-martins-ripping-news-the.html">johnarthurnichol.com</a></p>',
            date_published: '2026-07-01T04:03:09+00:00',
            id: '93223982',
            summary: '',
            url: 'https://johnarthurnichol.com/2026/07/01/sascha-martins-ripping-news-the.html',
            _microblog: {
              audio: {
                duration_display: '00:03:59',
                duration_seconds: 239,
                url: 'https://johnarthurnichol.com/uploads/2026/teaser.mp3',
              },
              date_relative: '04:03',
              is_podcast: true,
            },
          },
          {
            id: '',
            url: 'https://micro.blog/missing-id',
          },
        ],
      }),
    ).toEqual([
      {
        author_avatar:
          'https://avatars.micro.blog/avatars/2024/49/83234.jpg',
        author_name: 'John Arthur Nichol',
        author_url: 'https://johnarthurnichol.com',
        author_username: 'JohnAN',
        audio_url: 'https://johnarthurnichol.com/uploads/2026/teaser.mp3',
        date_relative: '04:03',
        duration_display: '00:03:59',
        duration_seconds: 239,
        id: '93223982',
        is_podcast: true,
        published_at: '2026-07-01T04:03:09+00:00',
        summary: '',
        title: "Sascha Martin's Ripping News, the Podcast: Teaser 3",
        url: 'https://johnarthurnichol.com/2026/07/01/sascha-martins-ripping-news-the.html',
      },
    ]);
  });

  test('is_playable_discover_post checks for audio_url', () => {
    expect(is_playable_discover_post({ audio_url: 'https://micro.blog/audio.m4a' })).toBe(true);
    expect(is_playable_discover_post({ audio_url: '' })).toBe(false);
  });

  test('resolve_discover_avatar_url unwraps cdn.micro.blog photo URLs', () => {
    expect(
      resolve_discover_avatar_url(
        'https://cdn.micro.blog/photos/96/https%3A%2F%2Favatars.micro.blog%2Favatars%2F2024%2F49%2F83234.jpg',
      ),
    ).toBe('https://avatars.micro.blog/avatars/2024/49/83234.jpg');
  });

  test('extract_discover_title strips trailing link labels from content_html', () => {
    expect(
      extract_discover_title(
        '<p>Crucial Track 🎵  July 1, 2026: <a href="https://john.philpin.com/2026/07/01/crucial-track-july.html">john.philpin.com</a></p>',
      ),
    ).toBe('Crucial Track 🎵 July 1, 2026');
  });

  test('resolve_discover_post_content uses title, author, avatar metadata, and date_relative', () => {
    expect(
      resolve_discover_post_content({
        author_name: 'John Arthur Nichol',
        date_relative: '04:03',
        published_at: '2026-07-01T04:03:09+00:00',
        summary:
          'Selling an aircraft requires careful interpretation of market signals to make strategic pricing decisions and maintain sales momentum.',
        title: "Sascha Martin's Ripping News, the Podcast: Teaser 3",
      }),
    ).toEqual({
      display_title: "Sascha Martin's Ripping News, the Podcast: Teaser 3",
      secondary_source_label: 'John Arthur Nichol',
      source_label: 'John Arthur Nichol',
      summary:
        'Selling an aircraft requires careful interpretation of market signals to make strategic pricing decisions and maintain sales momentum.',
      timestamp: '04:03',
    });
  });

  test('resolve_discover_post_content falls back to author name when title is missing', () => {
    expect(
      resolve_discover_post_content({
        author_name: 'John Arthur Nichol',
        published_at: '2026-07-01T04:03:09+00:00',
      }),
    ).toEqual({
      display_title: 'John Arthur Nichol',
      secondary_source_label: '',
      source_label: 'John Arthur Nichol',
      summary: '',
      timestamp: format_discover_timestamp('2026-07-01T04:03:09+00:00'),
    });
  });
});
