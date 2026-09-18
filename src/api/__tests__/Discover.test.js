const {
  fetch_discover_posts,
  fetch_listen_later_posts,
  remove_listen_later,
  save_listen_later,
} = require('../Discover');

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

  test('fetch_listen_later_posts requests the listen later feed with auth', async () => {
    global.fetch.mockResolvedValue({
      json: async () => ({
        items: [],
      }),
      ok: true,
    });

    await fetch_listen_later_posts({
      before_id: '55',
      token: 'token',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://micro.blog/posts/bookmarks/listenlater?before_id=55',
      {
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer token',
        },
        method: 'GET',
      },
    );
  });

  test('fetch_listen_later_posts requires a token', async () => {
    await expect(fetch_listen_later_posts()).rejects.toThrow(
      'You need to be signed in to Micro.blog to load Listen Later.',
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('fetch_listen_later_posts throws when the API returns an error', async () => {
    global.fetch.mockResolvedValue({
      json: async () => ({
        error: 'Unavailable',
      }),
      ok: false,
      status: 503,
    });

    await expect(fetch_listen_later_posts({ token: 'token' })).rejects.toThrow(
      'Unavailable',
    );
  });

  test('remove_listen_later deletes the bookmark by id', async () => {
    global.fetch.mockResolvedValue({
      json: async () => ({}),
      ok: true,
    });

    await remove_listen_later({
      id: '55',
      token: 'token',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://micro.blog/posts/bookmarks/55',
      {
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer token',
        },
        method: 'DELETE',
      },
    );
  });

  test('save_listen_later posts the bookmark id', async () => {
    global.fetch.mockResolvedValue({
      json: async () => ({}),
      ok: true,
    });

    await save_listen_later({
      id: '93223982',
      token: 'token',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://micro.blog/posts/bookmarks?id=93223982',
      {
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer token',
        },
        method: 'POST',
      },
    );
  });

  test('save_listen_later requires a token and id', async () => {
    await expect(save_listen_later({ id: '93223982' })).rejects.toThrow(
      'You need to be signed in to Micro.blog to save Listen Later episodes.',
    );
    await expect(save_listen_later({ token: 'token' })).rejects.toThrow(
      'A Discover episode is required.',
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('remove_listen_later requires a token and id', async () => {
    await expect(remove_listen_later({ id: '55' })).rejects.toThrow(
      'You need to be signed in to Micro.blog to remove Listen Later episodes.',
    );
    await expect(remove_listen_later({ token: 'token' })).rejects.toThrow(
      'A Listen Later episode is required.',
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
