jest.mock('../Tokens', () => ({
  __esModule: true,
  default: {
    get_user_token: jest.fn(() => 'token'),
  },
}));

jest.mock('../../api/Discover', () => ({
  DISCOVER_PAGE_SIZE: 40,
  DISCOVER_PODCASTS_TOPIC: 'podcasts',
  LISTEN_LATER_PAGE_SIZE: 25,
  fetch_discover_posts: jest.fn(async () => ({ items: [] })),
  fetch_listen_later_posts: jest.fn(async () => ({ items: [] })),
  remove_listen_later: jest.fn(async () => true),
  save_listen_later: jest.fn(async () => true),
}));

const { applySnapshot } = require('mobx-state-tree');
const {
  fetch_discover_posts,
  fetch_listen_later_posts,
  remove_listen_later,
  save_listen_later,
} = require('../../api/Discover');
const Discover = require('../Discover').default;

function listen_later_item({
  audio_url = 'https://cdn.micro.blog/episode.m4a',
  date_published = '2026-04-26T12:00:00Z',
  id = '55',
  name = 'Vincent',
  url = 'https://example.com/episode',
} = {}) {
  return {
    author: {
      name,
    },
    date_published,
    id,
    url,
    _microblog: {
      audio: {
        url: audio_url,
      },
      is_podcast: true,
    },
  };
}

describe('Discover store', () => {
  beforeEach(() => {
    applySnapshot(Discover, {
      listen_later_posts: [],
      posts: [],
      selected_filter: 'discover',
      topic: 'podcasts',
    });
    fetch_discover_posts.mockClear();
    fetch_listen_later_posts.mockClear();
    remove_listen_later.mockClear();
    save_listen_later.mockClear();
    save_listen_later.mockResolvedValue(true);
    fetch_discover_posts.mockResolvedValue({
      items: [
        {
          author: {
            avatar: 'https://cdn.micro.blog/avatar.jpg',
            name: 'Manton Reece',
            _microblog: {
              username: 'manton',
            },
          },
          date_published: '2026-06-02T12:00:00Z',
          id: '12345',
          summary: 'Morning microcast notes',
          url: 'https://micro.blog/12345',
        },
      ],
    });
  });

  test('refresh loads discover posts from the API', async () => {
    await Discover.refresh();

    expect(fetch_discover_posts).toHaveBeenCalledWith({
      token: 'token',
      topic: 'podcasts',
    });
    expect(Discover.posts).toHaveLength(1);
    expect(Discover.posts[0].author_name).toBe('Manton Reece');
    expect(Discover.posts[0].author_avatar).toBe('https://cdn.micro.blog/avatar.jpg');
  });

  test('play_post selects playable posts and ignores missing audio', () => {
    applySnapshot(Discover, {
      posts: [
        {
          audio_url: 'https://micro.blog/audio.m4a',
          id: '12345',
          url: 'https://micro.blog/12345',
        },
        {
          audio_url: '',
          id: '67890',
          url: 'https://micro.blog/67890',
        },
      ],
      topic: 'podcasts',
    });

    Discover.play_post('67890');
    expect(Discover.active_post_id).toBeNull();

    Discover.play_post('12345');
    expect(Discover.active_post_id).toBe('12345');
    expect(Discover.active_post()?.audio_url).toBe('https://micro.blog/audio.m4a');

    Discover.clear_playback();
    expect(Discover.active_post_id).toBeNull();
  });

  test('switching to listen later during a Discover refresh still loads the queue', async () => {
    let resolve_discover;

    fetch_discover_posts.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolve_discover = resolve;
        }),
    );

    const discover_refresh = Discover.refresh();
    Discover.set_selected_filter('listen_later');
    fetch_listen_later_posts.mockResolvedValueOnce({
      items: [listen_later_item()],
    });

    const listen_later_refresh = Discover.refresh();

    expect(fetch_listen_later_posts).toHaveBeenCalledWith({
      token: 'token',
    });

    resolve_discover({ items: [] });
    await Promise.all([discover_refresh, listen_later_refresh]);

    expect(Discover.listen_later_posts).toHaveLength(1);
    expect(Discover.posts).toHaveLength(0);
  });

  test('play_post prefers the selected list when ids collide', () => {
    applySnapshot(Discover, {
      listen_later_posts: [
        {
          audio_url: 'https://cdn.micro.blog/saved.m4a',
          id: '1',
          url: 'https://example.com/saved',
        },
      ],
      posts: [
        {
          audio_url: 'https://cdn.micro.blog/discover.m4a',
          id: '1',
          url: 'https://micro.blog/1',
        },
      ],
      selected_filter: 'listen_later',
      topic: 'podcasts',
    });

    Discover.play_post('1');
    expect(Discover.active_post()?.audio_url).toBe('https://cdn.micro.blog/saved.m4a');
  });

  test('refresh skips duplicate in-flight requests', async () => {
    let resolve_fetch;

    fetch_discover_posts.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolve_fetch = resolve;
        }),
    );

    const first_refresh = Discover.refresh();
    const second_refresh = Discover.refresh();

    expect(fetch_discover_posts).toHaveBeenCalledTimes(1);

    resolve_fetch({ items: [] });
    await Promise.all([first_refresh, second_refresh]);
  });

  test('load_more requests older posts using before_id', async () => {
    fetch_discover_posts.mockResolvedValueOnce({
      items: Array.from({ length: 40 }, (_, index) => ({
        author: {
          name: 'Manton Reece',
        },
        date_published: '2026-06-02T12:00:00Z',
        id: `${index + 1}`,
        summary: 'Morning microcast notes',
        url: `https://micro.blog/${index + 1}`,
      })),
    });
    await Discover.refresh();
    fetch_discover_posts.mockResolvedValueOnce({
      items: [
        {
          author: {
            name: 'Vincent',
          },
          date_published: '2026-06-01T12:00:00Z',
          id: '67890',
          summary: 'Earlier microcast',
          url: 'https://micro.blog/67890',
        },
      ],
    });

    await Discover.load_more();

    expect(fetch_discover_posts).toHaveBeenLastCalledWith({
      before_id: '40',
      token: 'token',
      topic: 'podcasts',
    });
    expect(Discover.posts).toHaveLength(41);
  });

  test('defaults to the Discover filter', () => {
    expect(Discover.selected_filter).toBe('discover');
  });

  test('set_selected_filter ignores unknown values', () => {
    Discover.set_selected_filter('listen_later');
    expect(Discover.selected_filter).toBe('listen_later');

    Discover.set_selected_filter('nope');
    expect(Discover.selected_filter).toBe('listen_later');
  });

  test('visible_posts returns Discover newest first and Listen Later in feed order', () => {
    applySnapshot(Discover, {
      listen_later_posts: [
        {
          audio_url: 'https://cdn.micro.blog/older.m4a',
          id: '55',
          published_at: '2026-01-01T12:00:00Z',
          url: 'https://example.com/older',
        },
        {
          audio_url: 'https://cdn.micro.blog/newer.m4a',
          id: '56',
          published_at: '2026-06-01T12:00:00Z',
          url: 'https://example.com/newer',
        },
      ],
      posts: [
        {
          id: '1',
          published_at: '2026-06-01T12:00:00Z',
          url: 'https://micro.blog/1',
        },
        {
          id: '2',
          published_at: '2026-06-03T12:00:00Z',
          url: 'https://micro.blog/2',
        },
      ],
      selected_filter: 'discover',
      topic: 'podcasts',
    });

    expect(Discover.visible_posts().map(post => post.id)).toEqual(['2', '1']);

    Discover.set_selected_filter('listen_later');
    expect(Discover.visible_posts().map(post => post.id)).toEqual(['55', '56']);
  });

  test('refresh loads listen later without clearing Discover posts', async () => {
    await Discover.refresh();
    Discover.set_selected_filter('listen_later');
    fetch_listen_later_posts.mockResolvedValueOnce({
      items: [listen_later_item()],
    });

    await Discover.refresh();

    expect(fetch_listen_later_posts).toHaveBeenCalledWith({
      token: 'token',
    });
    expect(Discover.listen_later_posts).toHaveLength(1);
    expect(Discover.listen_later_posts[0].id).toBe('55');
    expect(Discover.listen_later_posts[0].audio_url).toBe(
      'https://cdn.micro.blog/episode.m4a',
    );
    expect(Discover.posts).toHaveLength(1);
  });

  test('load_more pages listen later with a page size of 25', async () => {
    Discover.set_selected_filter('listen_later');
    fetch_listen_later_posts.mockResolvedValueOnce({
      items: Array.from({ length: 25 }, (_, index) => listen_later_item({
        id: `${index + 1}`,
        url: `https://example.com/${index + 1}`,
      })),
    });
    await Discover.refresh();
    fetch_listen_later_posts.mockResolvedValueOnce({
      items: [listen_later_item({ id: '99', url: 'https://example.com/99' })],
    });

    await Discover.load_more();

    expect(fetch_listen_later_posts).toHaveBeenLastCalledWith({
      before_id: '25',
      token: 'token',
    });
    expect(Discover.listen_later_posts).toHaveLength(26);
  });

  test('discover and listen later can keep the same id in separate lists', () => {
    applySnapshot(Discover, {
      listen_later_posts: [
        {
          id: '1',
          url: 'https://example.com/saved',
        },
      ],
      posts: [
        {
          id: '1',
          url: 'https://micro.blog/1',
        },
      ],
      selected_filter: 'discover',
      topic: 'podcasts',
    });

    expect(Discover.posts[0].url).toBe('https://micro.blog/1');
    expect(Discover.listen_later_posts[0].url).toBe('https://example.com/saved');
  });

  test('play_post can play a listen later episode', () => {
    applySnapshot(Discover, {
      listen_later_posts: [
        {
          audio_url: 'https://cdn.micro.blog/episode.m4a',
          id: '55',
          url: 'https://example.com/episode',
        },
      ],
      posts: [],
      selected_filter: 'listen_later',
      topic: 'podcasts',
    });

    Discover.play_post('55');
    expect(Discover.active_post_id).toBe('55');
    expect(Discover.active_post()?.audio_url).toBe('https://cdn.micro.blog/episode.m4a');
  });

  test('remove_listen_later deletes the episode and stops it if playing', async () => {
    applySnapshot(Discover, {
      listen_later_posts: [
        {
          audio_url: 'https://cdn.micro.blog/episode.m4a',
          id: '55',
          url: 'https://example.com/episode',
        },
        {
          audio_url: 'https://cdn.micro.blog/other.m4a',
          id: '56',
          url: 'https://example.com/other',
        },
      ],
      posts: [],
      selected_filter: 'listen_later',
      topic: 'podcasts',
    });
    Discover.play_post('55');

    await Discover.remove_listen_later('55');

    expect(remove_listen_later).toHaveBeenCalledWith({
      id: '55',
      token: 'token',
    });
    expect(Discover.listen_later_posts.map(post => post.id)).toEqual(['56']);
    expect(Discover.active_post_id).toBeNull();
  });

  test('remove_listen_later keeps the episode when the API fails', async () => {
    applySnapshot(Discover, {
      listen_later_posts: [
        {
          audio_url: 'https://cdn.micro.blog/episode.m4a',
          id: '55',
          url: 'https://example.com/episode',
        },
      ],
      posts: [],
      selected_filter: 'listen_later',
      topic: 'podcasts',
    });
    remove_listen_later.mockRejectedValueOnce(new Error('Nope'));

    await expect(Discover.remove_listen_later('55')).rejects.toThrow('Nope');
    expect(Discover.listen_later_posts.map(post => post.id)).toEqual(['55']);
  });

  test('save_listen_later marks the Discover episode saved and reloads Listen Later next time', async () => {
    await Discover.refresh();
    Discover.set_selected_filter('listen_later');
    await Discover.refresh();
    Discover.set_selected_filter('discover');

    expect(Discover.listen_later_did_hydrate).toBe(true);

    await Discover.save_listen_later('12345');

    expect(save_listen_later).toHaveBeenCalledWith({
      id: '12345',
      token: 'token',
    });
    expect(Discover.posts[0].is_saved).toBe(true);
    expect(Discover.listen_later_did_hydrate).toBe(false);
  });

  test('remove_listen_later unsaves a Discover episode matched by url', async () => {
    applySnapshot(Discover, {
      listen_later_posts: [
        {
          audio_url: 'https://cdn.micro.blog/episode.m4a',
          id: '99',
          is_saved: true,
          url: 'https://example.com/episode',
        },
      ],
      posts: [
        {
          audio_url: 'https://cdn.micro.blog/episode.m4a',
          id: '12345',
          is_saved: true,
          url: 'https://example.com/episode',
        },
      ],
      selected_filter: 'listen_later',
      topic: 'podcasts',
    });

    await Discover.remove_listen_later('99');

    expect(Discover.listen_later_posts).toHaveLength(0);
    expect(Discover.posts[0].is_saved).toBe(false);
  });

  test('remove_listen_later can unsave a Discover episode by post id', async () => {
    await Discover.refresh();
    await Discover.save_listen_later('12345');

    await Discover.remove_listen_later('12345');

    expect(remove_listen_later).toHaveBeenCalledWith({
      id: '12345',
      token: 'token',
    });
    expect(Discover.posts[0].is_saved).toBe(false);
  });

  test('save_listen_later leaves the episode unsaved when the API fails', async () => {
    await Discover.refresh();
    save_listen_later.mockRejectedValueOnce(new Error('Nope'));

    await expect(Discover.save_listen_later('12345')).rejects.toThrow('Nope');
    expect(Discover.posts[0].is_saved).toBe(false);
  });
});
