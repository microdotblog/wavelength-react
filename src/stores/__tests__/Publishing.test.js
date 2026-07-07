jest.mock('../Auth', () => ({
  __esModule: true,
  default: {
    default_site: 'https://test.micro.blog',
  },
}));

jest.mock('../Episodes', () => ({
  __esModule: true,
  default: {
    export_merged_audio: jest.fn(async () => 'file:///tmp/exported.m4a'),
    get_episode: jest.fn(),
    get_episode_by_post_id: jest.fn(() => null),
    get_episode_for_post: jest.fn(() => null),
    mark_episode_published: jest.fn(async () => ({ id: 'episode-1' })),
  },
}));

jest.mock('../Posts', () => ({
  __esModule: true,
  default: {
    refresh: jest.fn(async () => null),
  },
}));

jest.mock('../Tokens', () => ({
  __esModule: true,
  default: {
    get_user_token: jest.fn(() => 'token'),
  },
}));

jest.mock('../../api/Micropub', () => ({
  create_episode_post: jest.fn(async () => 'https://example.micro.blog/post/1'),
  fetch_micropub_categories: jest.fn(async () => ({ categories: ['microcast'] })),
  fetch_micropub_post_id: jest.fn(async () => '12345'),
  fetch_micropub_post_source: jest.fn(async () => ({
    categories: ['microcast'],
    content: '<p>Existing notes</p>',
    post_status: 'published',
    summary: 'Episode summary',
    title: 'Existing title',
    uid: '12345',
    url: 'https://example.micro.blog/post/1',
  })),
  fetch_micropub_syndicate_targets: jest.fn(async () => ({
    'syndicate-to': [{ name: 'Twitter', uid: 'twitter' }],
  })),
  update_micropub_post: jest.fn(async () => true),
  upload_episode_audio: jest.fn(async () => 'https://micro.blog/uploaded.m4a'),
}));

jest.mock('../../lib/episode_upload_size', () => ({
  build_upload_size_limit_message: jest.fn(size_bytes => `This episode is ${size_bytes} bytes. Micro.blog uploads must be 75 MB or smaller.`),
  is_over_upload_limit: jest.fn(size_bytes => size_bytes > 75_000_000),
}));

jest.mock('../../lib/EpisodeStorage', () => ({
  read_file_size_bytes: jest.fn(() => 1_000_000),
}));

const Episodes = require('../Episodes').default;
const Posts = require('../Posts').default;
const {
  create_episode_post,
  fetch_micropub_post_id,
  fetch_micropub_post_source,
  update_micropub_post,
  upload_episode_audio,
} = require('../../api/Micropub');
const {
  build_upload_size_limit_message,
} = require('../../lib/episode_upload_size');
const { read_file_size_bytes } = require('../../lib/EpisodeStorage');

const Publishing = require('../Publishing').default;

describe('Publishing store', () => {
  beforeEach(() => {
    Publishing.reset();
    Publishing.reset_editor();
    Episodes.export_merged_audio.mockClear();
    Episodes.mark_episode_published.mockClear();
    Posts.refresh.mockClear();
    create_episode_post.mockClear();
    fetch_micropub_post_id.mockClear();
    fetch_micropub_post_source.mockClear();
    upload_episode_audio.mockClear();
    read_file_size_bytes.mockClear();
    build_upload_size_limit_message.mockClear();
    Episodes.export_merged_audio.mockResolvedValue('file:///tmp/exported.m4a');
    read_file_size_bytes.mockReturnValue(1_000_000);
    Episodes.get_episode_for_post.mockReturnValue(null);
  });

  test('handle_text_action applies formatting to post_content', () => {
    Publishing.set_post_content('hello world');
    Publishing.set_text_selection({ end: 5, start: 0 });
    Publishing.handle_text_action('bold');

    expect(Publishing.post_content).toBe('**hello** world');
    expect(Publishing.text_selection_start).toBe(9);
    expect(Publishing.text_selection_end).toBe(9);
  });

  test('handle_post_status_select updates draft status and button label', () => {
    Publishing.handle_post_status_select('draft');

    expect(Publishing.post_status).toBe('draft');
    expect(Publishing.post_button_label()).toBe('Save');
  });

  test('handle_post_category_select toggles categories', () => {
    Publishing.handle_post_category_select('microcast');
    Publishing.handle_post_category_select('microcast');

    expect(Publishing.post_categories).toEqual([]);
  });

  test('load_editor_options populates categories and syndicates', async () => {
    await Publishing.load_editor_options();

    expect(Publishing.available_categories).toEqual(['microcast']);
    expect(Publishing.available_syndicates).toEqual([{ name: 'Twitter', uid: 'twitter' }]);
  });

  test('publish_episode marks the episode published and refreshes posts', async () => {
    const post_url = await Publishing.publish_episode('episode-1');

    expect(post_url).toBe('https://example.micro.blog/post/1');
    expect(Episodes.mark_episode_published).toHaveBeenCalledWith('episode-1', {
      post_id: '12345',
      post_url: 'https://example.micro.blog/post/1',
    });
    expect(Posts.refresh).toHaveBeenCalled();
  });

  test('prep_post_edit hydrates the editor and links a local episode by post uid', () => {
    Episodes.get_episode_for_post.mockReturnValueOnce({ id: 'episode-1' });

    Publishing.prep_post_edit({
      content: '<p>Notes</p>',
      post_status: 'published',
      title: 'Morning show',
      uid: '12345',
      url: 'https://example.micro.blog/post/1',
    });

    expect(Publishing.is_editing_post).toBe(true);
    expect(Publishing.post_uid).toBe('12345');
    expect(Publishing.post_url).toBe('https://example.micro.blog/post/1');
    expect(Publishing.editor_episode_id).toBe('episode-1');
    expect(Publishing.post_button_label()).toBe('Update');
  });

  test('prep_post_edit prefers an explicit episode id when provided', () => {
    Episodes.get_episode.mockReturnValueOnce({ id: 'episode-2' });

    Publishing.prep_post_edit({
      content: '<p>Notes</p>',
      uid: '12345',
      url: 'https://example.micro.blog/post/1',
    }, { episode_id: 'episode-2' });

    expect(Episodes.get_episode).toHaveBeenCalledWith('episode-2');
    expect(Publishing.editor_episode_id).toBe('episode-2');
  });

  test('load_post_source hydrates editor fields and relinks the local episode', async () => {
    Episodes.get_episode_for_post.mockReturnValue({ id: 'episode-1' });

    Publishing.prep_post_edit({
      content: '<p>Local notes</p>',
      post_status: 'published',
      title: 'Local title',
      uid: '12345',
      url: 'https://example.micro.blog/post/1',
    });

    await Publishing.load_post_source();

    expect(fetch_micropub_post_source).toHaveBeenCalledWith({
      destination: 'https://test.micro.blog',
      post_url: 'https://example.micro.blog/post/1',
      token: 'token',
    });
    expect(Publishing.post_title).toBe('Existing title');
    expect(Publishing.post_content).toBe('<p>Existing notes</p>');
    expect(Publishing.post_categories).toEqual(['microcast']);
    expect(Publishing.summary).toBe('Episode summary');
    expect(Publishing.editor_episode_id).toBe('episode-1');
  });

  test('publish_episode skips publish metadata when saving a draft', async () => {
    Publishing.handle_post_status_select('draft');

    const post_url = await Publishing.publish_episode('episode-1');

    expect(post_url).toBe('https://example.micro.blog/post/1');
    expect(fetch_micropub_post_id).not.toHaveBeenCalled();
    expect(Episodes.mark_episode_published).not.toHaveBeenCalled();
    expect(Posts.refresh).not.toHaveBeenCalled();
  });

  test('publish_episode resets phase and sets an error when export fails', async () => {
    Episodes.export_merged_audio.mockResolvedValueOnce('');

    const post_url = await Publishing.publish_episode('episode-1');

    expect(post_url).toBeNull();
    expect(Publishing.phase).toBe('idle');
    expect(Publishing.error_message).toBe('We could not prepare this episode for publishing.');
    expect(create_episode_post).not.toHaveBeenCalled();
  });

  test('publish_episode blocks oversized exported audio before upload', async () => {
    read_file_size_bytes.mockReturnValueOnce(80_000_000);

    const post_url = await Publishing.publish_episode('episode-1');

    expect(post_url).toBeNull();
    expect(Publishing.phase).toBe('idle');
    expect(Publishing.error_message).toBe('This episode is 80000000 bytes. Micro.blog uploads must be 75 MB or smaller.');
    expect(upload_episode_audio).not.toHaveBeenCalled();
    expect(create_episode_post).not.toHaveBeenCalled();
  });

  test('update_post sends micropub update and refreshes posts', async () => {
    Publishing.prep_post_edit({
      content: '<p>Notes</p>',
      post_status: 'published',
      title: 'Morning show',
      uid: '12345',
      url: 'https://example.micro.blog/post/1',
    });
    Publishing.set_post_content('<p>Updated notes</p>');

    const updated = await Publishing.update_post();

    expect(updated).toBe(true);
    expect(update_micropub_post).toHaveBeenCalledWith(expect.objectContaining({
      content: '<p>Updated notes</p>',
      post_url: 'https://example.micro.blog/post/1',
      title: 'Morning show',
    }));
    expect(Posts.refresh).toHaveBeenCalled();
  });
});