jest.mock('../Auth', () => ({
  __esModule: true,
  default: {
    default_site: 'https://test.micro.blog',
  },
}));

jest.mock('../Tokens', () => ({
  __esModule: true,
  default: {
    get_user_token: jest.fn(() => 'token'),
  },
}));

jest.mock('../../api/Micropub', () => ({
  delete_micropub_post: jest.fn(async () => true),
  fetch_micropub_posts: jest.fn(async () => ({ items: [] })),
}));

const { applySnapshot } = require('mobx-state-tree');
const { delete_micropub_post } = require('../../api/Micropub');
const Posts = require('../Posts').default;

describe('Posts store', () => {
  beforeEach(() => {
    applySnapshot(Posts, {
      posts: [
        {
          content: '<audio controls src="https://micro.blog/audio.m4a"></audio>',
          post_status: 'published',
          published_at: '2026-06-02T12:00:00Z',
          title: 'Morning microcast',
          uid: '12345',
          url: 'https://example.micro.blog/post/1',
        },
      ],
    });
    delete_micropub_post.mockClear();
  });

  test('delete_post removes a post after micropub delete succeeds', async () => {
    await Posts.delete_post('12345');

    expect(delete_micropub_post).toHaveBeenCalledWith({
      destination: 'https://test.micro.blog',
      post_url: 'https://example.micro.blog/post/1',
      token: 'token',
    });
    expect(Posts.posts).toHaveLength(0);
  });
});
