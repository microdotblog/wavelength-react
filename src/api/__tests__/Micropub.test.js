const { build_episode_post_body } = require('../Micropub');

describe('Micropub build_episode_post_body', () => {
  test('includes summary and syndicate targets in post body', () => {
    const body = build_episode_post_body({
      audio_url: 'https://micro.blog/audio.m4a',
      categories: ['microcast'],
      content: 'Show notes',
      destination: 'https://example.micro.blog',
      status: 'draft',
      summary: 'Episode summary',
      syndicates: ['twitter', 'mastodon'],
      title: 'Episode title',
    });

    expect(body.get('summary')).toBe('Episode summary');
    expect(body.get('post-status')).toBe('draft');
    expect(body.getAll('category[]')).toEqual(['microcast']);
    expect(body.getAll('mp-syndicate-to[]')).toEqual(['twitter', 'mastodon']);
  });
});