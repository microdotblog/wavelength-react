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
  create_episode_post,
  delete_micropub_post,
  fetch_micropub_config,
  resolve_audio_mime_type,
  resolve_uploaded_url,
  update_micropub_post,
  upload_episode_audio,
} = require('../Micropub');

describe('Micropub fetch_micropub_config', () => {
  beforeEach(() => {
    global.fetch = jest.fn(async () => ({
      json: async () => ({
        destination: [
          {
            name: 'example.micro.blog',
            uid: 'https://example.micro.blog/',
          },
        ],
      }),
      ok: true,
    }));
  });

  test('loads the destination list from the Micropub config query', async () => {
    const payload = await fetch_micropub_config({ token: 'token' });

    expect(payload.destination).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://micro.blog/micropub?q=config',
      {
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer token',
        },
        method: 'GET',
      },
    );
  });
});

describe('Micropub resolve_uploaded_url', () => {
  test('prefers the Location header over the JSON body url', () => {
    expect(resolve_uploaded_url('https://micro.blog/header-url', { url: 'https://micro.blog/body-url' }))
      .toBe('https://micro.blog/header-url');
  });

  test('falls back to the JSON body url when Location is missing', () => {
    expect(resolve_uploaded_url('', { url: 'https://micro.blog/body-url' }))
      .toBe('https://micro.blog/body-url');
  });

  test('returns empty string when neither source is present', () => {
    expect(resolve_uploaded_url('', null)).toBe('');
  });
});

describe('Micropub resolve_audio_mime_type', () => {
  test('uses audio/mpeg for MP3 exports', () => {
    expect(resolve_audio_mime_type('file:///tmp/exported.mp3')).toBe('audio/mpeg');
  });

  test('keeps audio/mp4 for AAC exports', () => {
    expect(resolve_audio_mime_type('file:///tmp/exported.m4a')).toBe('audio/mp4');
  });
});

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

  test('uploads MP3 audio with native multipart upload', async () => {
    const upload = jest.fn(async () => ({
      body: JSON.stringify({ url: 'https://micro.blog/uploaded.mp3' }),
      headers: { Location: 'https://micro.blog/uploaded.mp3' },
      status: 202,
    }));

    File.mockImplementation(function MockFile() {
      this.exists = true;
      this.upload = upload;
    });

    const audio_url = await upload_episode_audio({
      destination: 'https://test.micro.blog',
      file_uri: 'file:///tmp/exported.mp3',
      token: 'token',
    });

    expect(audio_url).toBe('https://micro.blog/uploaded.mp3');
    expect(upload).toHaveBeenCalledWith('https://micro.blog/micropub/media', {
      fieldName: 'file',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer token',
      },
      mimeType: 'audio/mpeg',
      parameters: { 'mp-destination': 'https://test.micro.blog' },
      uploadType: UploadType.MULTIPART,
    });
  });

  test('uploads a temporary copy with the requested filename', async () => {
    const copy = jest.fn(async () => null);
    const remove = jest.fn();
    const upload = jest.fn(async () => ({
      body: JSON.stringify({ url: 'https://micro.blog/episode-123-hello.mp3' }),
      headers: { Location: 'https://micro.blog/episode-123-hello.mp3' },
      status: 202,
    }));
    const source_file = {
      copy,
      exists: true,
      name: 'exported.mp3',
      parentDirectory: { uri: 'file:///tmp' },
      uri: 'file:///tmp/exported.mp3',
    };
    const upload_file = {
      delete: remove,
      exists: true,
      name: 'episode-123-hello.mp3',
      upload,
      uri: 'file:///tmp/episode-123-hello.mp3',
    };

    File.mockImplementation(function MockFile(_parent, name) {
      return name ? upload_file : source_file;
    });

    const audio_url = await upload_episode_audio({
      file_name: 'episode-123-hello.mp3',
      file_uri: 'file:///tmp/exported.mp3',
      token: 'token',
    });

    expect(audio_url).toBe('https://micro.blog/episode-123-hello.mp3');
    expect(copy).toHaveBeenCalledWith(upload_file, { overwrite: true });
    expect(upload).toHaveBeenCalled();
    expect(remove).toHaveBeenCalled();
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

describe('Micropub create_episode_post', () => {
  beforeEach(() => {
    global.fetch = jest.fn(async () => ({
      headers: {
        get: jest.fn(name => (name === 'Location' ? 'https://micro.blog/post/header' : null)),
      },
      json: async () => ({ url: 'https://micro.blog/post/body' }),
      ok: true,
    }));
  });

  test('posts form-encoded micropub data and resolves the published url', async () => {
    const post_url = await create_episode_post({
      audio_url: 'https://micro.blog/uploaded.m4a',
      categories: ['microcast'],
      content: 'Show notes',
      destination: 'https://example.micro.blog',
      status: 'published',
      summary: 'Episode summary',
      syndicates: ['twitter'],
      title: 'Episode title',
      token: 'token',
    });

    expect(post_url).toBe('https://micro.blog/post/header');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://micro.blog/micropub',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer token',
          'Content-Type': 'application/x-www-form-urlencoded',
        }),
      }),
    );
  });

  test('throws when audio has not been uploaded yet', async () => {
    await expect(create_episode_post({
      audio_url: '',
      token: 'token',
    })).rejects.toThrow('The episode audio must be uploaded before posting.');
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
