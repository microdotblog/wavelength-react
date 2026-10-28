jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('../EpisodeStorage', () => ({ read_file_size_bytes: jest.fn(() => 1000) }));
jest.mock('../episode_audio', () => ({
  delete_audio_file: jest.fn(),
  export_episode_mp3: jest.fn(async () => 'file:///tmp/take.mp3'),
}));

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
const {
  attach_narration_to_post,
  remove_narration_from_post,
} = require('../attach_narration');
const { Platform } = require('react-native');
const { read_file_size_bytes } = require('../EpisodeStorage');
const { delete_audio_file, export_episode_mp3 } = require('../episode_audio');

describe('attach_narration_to_post', () => {
  beforeEach(() => {
    Platform.OS = 'android';
    delete_audio_file.mockClear();
    export_episode_mp3.mockClear();
    read_file_size_bytes.mockReset().mockReturnValue(1000);
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
      audio_url: 'https://micro.blog/read.m4a',
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

  test('exports iOS narration to MP3 and removes only the temporary upload', async () => {
    Platform.OS = 'ios';
    upload_episode_audio.mockResolvedValue('https://micro.blog/read.mp3');
    fetch_micropub_post_source.mockResolvedValue({ content: 'Hello' });

    await attach_narration_to_post({ file_uri: 'file:///tmp/take.m4a', file_name: 'narration.m4a' });

    expect(export_episode_mp3).toHaveBeenCalledWith('file:///tmp/take.m4a');
    expect(upload_episode_audio).toHaveBeenCalledWith(expect.objectContaining({
      file_uri: 'file:///tmp/take.mp3', file_name: 'narration.mp3',
    }));
    expect(delete_audio_file).toHaveBeenCalledTimes(1);
    expect(delete_audio_file).toHaveBeenCalledWith('file:///tmp/take.mp3');
  });

  test('checks the compressed narration upload size and cleans up on failure', async () => {
    Platform.OS = 'ios';
    read_file_size_bytes.mockReturnValue(80_000_000);

    await expect(attach_narration_to_post({ file_uri: 'file:///tmp/take.m4a' }))
      .rejects.toThrow('This narration is 80 MB.');
    expect(upload_episode_audio).not.toHaveBeenCalled();
    expect(delete_audio_file).toHaveBeenCalledWith('file:///tmp/take.mp3');
  });
});

describe('remove_narration_from_post', () => {
  beforeEach(() => {
    fetch_micropub_post_source.mockReset();
    update_micropub_post.mockReset();
  });

  test('strips the hidden tag and updates the post without audio', async () => {
    fetch_micropub_post_source.mockResolvedValue({
      categories: ['notes'],
      content: '<audio src="https://micro.blog/read.m4a" preload="metadata" style="display: none"></audio>\n<p>Hello</p>',
      post_status: 'published',
      summary: '',
      title: 'Existing title',
      uid: '1',
      url: 'https://example.micro.blog/1',
    });
    update_micropub_post.mockResolvedValue(true);

    const result = await remove_narration_from_post({
      destination: 'https://example.micro.blog/',
      post_url: 'https://example.micro.blog/1',
      token: 'token',
    });

    expect(update_micropub_post).toHaveBeenCalledWith({
      categories: ['notes'],
      content: '<p>Hello</p>',
      destination: 'https://example.micro.blog/',
      post_url: 'https://example.micro.blog/1',
      status: 'published',
      summary: '',
      title: 'Existing title',
      token: 'token',
    });
    expect(result).toEqual({ content: '<p>Hello</p>' });
  });

  test('throws when the post source cannot be loaded', async () => {
    fetch_micropub_post_source.mockResolvedValue(null);

    await expect(remove_narration_from_post({
      post_url: 'https://example.micro.blog/1',
      token: 'token',
    })).rejects.toThrow('We could not load this post to remove narration.');

    expect(update_micropub_post).not.toHaveBeenCalled();
  });
});
