jest.mock('../../api/Micropub', () => ({
  fetch_micropub_post_source: jest.fn(),
  update_micropub_post: jest.fn(),
  upload_episode_audio: jest.fn(),
}));

const {
  fetch_micropub_post_source,
  update_micropub_post,
  upload_episode_audio,
} = require('../../api/Micropub');
const { attach_narration_to_post } = require('../attach_narration');

describe('attach_narration_to_post', () => {
  beforeEach(() => {
    upload_episode_audio.mockReset();
    fetch_micropub_post_source.mockReset();
    update_micropub_post.mockReset();
  });

  test('uploads audio and updates content with a hidden tag', async () => {
    upload_episode_audio.mockResolvedValue('https://micro.blog/read.m4a');
    fetch_micropub_post_source.mockResolvedValue({
      categories: ['notes'],
      content: '<p>Hello</p>',
      post_status: 'published',
      summary: '',
      title: 'Existing title',
      uid: '1',
      url: 'https://example.micro.blog/1',
    });
    update_micropub_post.mockResolvedValue(true);

    const result = await attach_narration_to_post({
      destination: 'https://example.micro.blog/',
      file_name: 'narration.m4a',
      file_uri: 'file:///tmp/take.m4a',
      post_url: 'https://example.micro.blog/1',
      token: 'token',
    });

    expect(upload_episode_audio).toHaveBeenCalledWith({
      destination: 'https://example.micro.blog/',
      file_name: 'narration.m4a',
      file_uri: 'file:///tmp/take.m4a',
      token: 'token',
    });
    expect(update_micropub_post).toHaveBeenCalledWith({
      categories: ['notes'],
      content: '<audio src="https://micro.blog/read.m4a" preload="metadata" style="display: none"></audio>\n<p>Hello</p>',
      destination: 'https://example.micro.blog/',
      post_url: 'https://example.micro.blog/1',
      status: 'published',
      summary: '',
      title: 'Existing title',
      token: 'token',
    });
    expect(result).toEqual({
      audio_url: 'https://micro.blog/read.m4a',
      content: '<audio src="https://micro.blog/read.m4a" preload="metadata" style="display: none"></audio>\n<p>Hello</p>',
    });
  });

  test('replaces an existing hidden tag on the source content', async () => {
    upload_episode_audio.mockResolvedValue('https://micro.blog/new.m4a');
    fetch_micropub_post_source.mockResolvedValue({
      categories: [],
      content: '<audio src="https://micro.blog/old.m4a" preload="metadata" style="display: none"></audio>\n<p>Hello</p>',
      post_status: 'published',
      summary: 'Summary',
      title: 'Essay',
      uid: '2',
      url: 'https://example.micro.blog/2',
    });
    update_micropub_post.mockResolvedValue(true);

    const result = await attach_narration_to_post({
      destination: 'https://example.micro.blog/',
      file_uri: 'file:///tmp/take.m4a',
      post_url: 'https://example.micro.blog/2',
      token: 'token',
    });

    expect(result.content).toContain('src="https://micro.blog/new.m4a"');
    expect(result.content).not.toContain('old.m4a');
  });

  test('throws when the post source cannot be loaded', async () => {
    upload_episode_audio.mockResolvedValue('https://micro.blog/read.m4a');
    fetch_micropub_post_source.mockResolvedValue(null);

    await expect(attach_narration_to_post({
      file_uri: 'file:///tmp/take.m4a',
      post_url: 'https://example.micro.blog/1',
      token: 'token',
    })).rejects.toThrow('We could not load this post to add narration.');

    expect(update_micropub_post).not.toHaveBeenCalled();
  });
});
