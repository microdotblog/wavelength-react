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

jest.mock('../../lib/attach_narration', () => ({
  attach_narration_to_post: jest.fn(),
}));

const { applySnapshot } = require('mobx-state-tree');
const { delete_micropub_post } = require('../../api/Micropub');
const { attach_narration_to_post } = require('../../lib/attach_narration');
const Posts = require('../Posts').default;

const SAMPLE_POSTS = [
  {
    content: '<p>Note</p>',
    post_status: 'published',
    published_at: '2026-06-01T12:00:00Z',
    title: 'Note',
    uid: '1',
    url: 'https://example.micro.blog/1',
  },
  {
    content: '<audio controls src="https://micro.blog/a.m4a"></audio>',
    post_status: 'published',
    published_at: '2026-06-02T12:00:00Z',
    title: 'Show',
    uid: '2',
    url: 'https://example.micro.blog/2',
  },
  {
    content: '<audio src="https://micro.blog/r.m4a" preload="metadata" style="display: none"></audio><p>Essay</p>',
    post_status: 'published',
    published_at: '2026-06-03T12:00:00Z',
    title: 'Essay',
    uid: '3',
    url: 'https://example.micro.blog/3',
  },
];

describe('Posts store', () => {
  beforeEach(() => {
    applySnapshot(Posts, {
      posts: SAMPLE_POSTS,
      selected_filter: 'all',
    });
    delete_micropub_post.mockClear();
    attach_narration_to_post.mockReset();
  });

  test('delete_post removes a post after micropub delete succeeds', async () => {
    await Posts.delete_post('2');

    expect(delete_micropub_post).toHaveBeenCalledWith({
      destination: 'https://test.micro.blog',
      post_url: 'https://example.micro.blog/2',
      token: 'token',
    });
    expect(Posts.get_post('2')).toBeNull();
  });

  test('filtered_posts respects selected_filter', () => {
    expect(Posts.filtered_posts().map(post => post.uid)).toEqual(['3', '2', '1']);

    Posts.set_selected_filter('posts');
    expect(Posts.filtered_posts().map(post => post.uid)).toEqual(['1']);

    Posts.set_selected_filter('podcasts');
    expect(Posts.filtered_posts().map(post => post.uid)).toEqual(['2']);

    Posts.set_selected_filter('narrated');
    expect(Posts.filtered_posts().map(post => post.uid)).toEqual(['3']);

    Posts.set_selected_filter('all');
    expect(Posts.filtered_posts().map(post => post.uid)).toEqual(['3', '2', '1']);
  });

  test('set_selected_filter ignores unknown values', () => {
    Posts.set_selected_filter('podcasts');
    Posts.set_selected_filter('nope');
    expect(Posts.selected_filter).toBe('podcasts');
  });

  test('attach_narration uploads, updates the post, and patches local content', async () => {
    const next_content = '<audio src="https://micro.blog/read.m4a" preload="metadata" style="display: none"></audio>\n<p>Note</p>';

    attach_narration_to_post.mockResolvedValue({
      audio_url: 'https://micro.blog/read.m4a',
      content: next_content,
    });

    const result = await Posts.attach_narration('1', 'file:///tmp/take.m4a');

    expect(attach_narration_to_post).toHaveBeenCalledWith({
      destination: 'https://test.micro.blog',
      file_name: 'narration.m4a',
      file_uri: 'file:///tmp/take.m4a',
      post_url: 'https://example.micro.blog/1',
      token: 'token',
    });
    expect(Posts.get_post('1').content).toBe(next_content);
    expect(result.audio_url).toBe('https://micro.blog/read.m4a');
  });

  test('attach_narration throws when the post is missing', async () => {
    await expect(Posts.attach_narration('missing', 'file:///tmp/take.m4a')).rejects.toThrow(
      'This post is no longer available.',
    );
    expect(attach_narration_to_post).not.toHaveBeenCalled();
  });

  test('attach_narration clears is_attaching after failure', async () => {
    attach_narration_to_post.mockRejectedValue(new Error('nope'));

    await expect(Posts.attach_narration('1', 'file:///tmp/take.m4a')).rejects.toThrow('nope');
    expect(Posts.is_attaching).toBe(false);
    expect(Posts.attach_phase).toBe('idle');
  });
});
