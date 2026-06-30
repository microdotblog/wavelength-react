jest.mock('expo-file-system', () => {
  const UploadType = { MULTIPART: 1 };

  return {
    File: jest.fn(),
    UploadType,
  };
});

const { File, UploadType } = require('expo-file-system');
const {
  build_episode_post_body,
  delete_micropub_post,
  update_micropub_post,
  upload_episode_audio,
} = require('../Micropub');

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

describe('Micropub upload_episode_audio', () => {
  beforeEach(() => {
    File.mockReset();
  });

  test('uploads merged audio with native multipart upload', async () => {
    const upload = jest.fn(async () => ({
      body: JSON.stringify({ url: 'https://micro.blog/uploaded.m4a' }),
      headers: { Location: 'https://micro.blog/uploaded.m4a' },
      status: 202,
    }));

    File.mockImplementation(function MockFile() {
      this.exists = true;
      this.upload = upload;
    });

    const audio_url = await upload_episode_audio({
      destination: 'https://test.micro.blog',
      file_uri: 'file:///tmp/exported.m4a',
      token: 'token',
    });

    expect(audio_url).toBe('https://micro.blog/uploaded.m4a');
    expect(upload).toHaveBeenCalledWith('https://micro.blog/micropub/media', {
      fieldName: 'file',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer token',
      },
      mimeType: 'audio/mp4',
      parameters: { 'mp-destination': 'https://test.micro.blog' },
      uploadType: UploadType.MULTIPART,
    });
  });
});

describe('Micropub delete_micropub_post', () => {
  beforeEach(() => {
    global.fetch = jest.fn(async () => ({
      json: async () => ({}),
      ok: true,
    }));
  });

  test('posts a micropub delete action for the published post url', async () => {
    await delete_micropub_post({
      destination: 'https://example.micro.blog',
      post_url: 'https://example.micro.blog/post/1',
      token: 'token',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://micro.blog/micropub',
      expect.objectContaining({
        body: 'action=delete&url=https%3A%2F%2Fexample.micro.blog%2Fpost%2F1&mp-destination=https%3A%2F%2Fexample.micro.blog',
        headers: expect.objectContaining({
          Authorization: 'Bearer token',
        }),
        method: 'POST',
      }),
    );
  });
});

describe('Micropub update_micropub_post', () => {
  beforeEach(() => {
    global.fetch = jest.fn(async () => ({
      json: async () => ({}),
      ok: true,
    }));
  });

  test('posts a micropub update action with replace fields', async () => {
    await update_micropub_post({
      categories: ['microcast'],
      content: '<p>Updated notes</p>',
      destination: 'https://example.micro.blog',
      post_url: 'https://example.micro.blog/post/1',
      status: 'published',
      summary: 'Updated summary',
      title: 'Updated title',
      token: 'token',
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, request] = global.fetch.mock.calls[0];

    expect(url).toBe('https://micro.blog/micropub');
    expect(request.method).toBe('POST');
    expect(request.headers).toEqual(expect.objectContaining({
      Authorization: 'Bearer token',
      'Content-Type': 'application/json',
    }));
    expect(JSON.parse(request.body)).toEqual({
      action: 'update',
      'mp-destination': 'https://example.micro.blog',
      replace: {
        category: ['microcast'],
        content: ['<p>Updated notes</p>'],
        name: ['Updated title'],
        'post-status': ['published'],
        summary: ['Updated summary'],
      },
      url: 'https://example.micro.blog/post/1',
    });
  });
});