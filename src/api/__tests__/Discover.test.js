const { fetch_discover_posts } = require('../Discover');

describe('Discover API', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  test('fetch_discover_posts requests the topic feed with optional auth', async () => {
    global.fetch.mockResolvedValue({
      json: async () => ({
        items: [],
      }),
      ok: true,
    });

    await fetch_discover_posts({
      before_id: '12345',
      token: 'token',
      topic: 'podcasts',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://micro.blog/posts/discover/podcasts?before_id=12345',
      {
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer token',
        },
        method: 'GET',
      },
    );
  });

  test('fetch_discover_posts throws when the API returns an error', async () => {
    global.fetch.mockResolvedValue({
      json: async () => ({
        error: 'Unavailable',
      }),
      ok: false,
      status: 503,
    });

    await expect(fetch_discover_posts({ topic: 'podcasts' })).rejects.toThrow(
      'Unavailable',
    );
  });
});
