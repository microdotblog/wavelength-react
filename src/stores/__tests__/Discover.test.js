jest.mock('../Tokens', () => ({
  __esModule: true,
  default: {
    get_user_token: jest.fn(() => 'token'),
  },
}));

jest.mock('../../api/Discover', () => ({
  DISCOVER_PODCASTS_TOPIC: 'podcasts',
  fetch_discover_posts: jest.fn(async () => ({ items: [] })),
}));

const { applySnapshot } = require('mobx-state-tree');
const { fetch_discover_posts } = require('../../api/Discover');
const Discover = require('../Discover').default;

describe('Discover store', () => {
  beforeEach(() => {
    applySnapshot(Discover, {
      posts: [],
      topic: 'podcasts',
    });
    fetch_discover_posts.mockClear();
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
});
