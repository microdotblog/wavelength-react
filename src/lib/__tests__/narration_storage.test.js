const { Directory, File, Paths } = require('expo-file-system');
const {
  append_clip_to_narration,
  copy_narration_take,
  create_narration_draft,
  delete_narration_draft,
  download_remote_audio,
  narration_draft_id,
  replace_narration_clips,
} = require('../narration_storage');

const memory = new Map();

function join_uri(...parts) {
  return parts
    .map(part => {
      if (typeof part === 'string') {
        return part.replace(/\/+$/, '');
      }

      return `${part?.uri || ''}`.replace(/\/+$/, '');
    })
    .filter(Boolean)
    .join('/');
}

function basename(uri = '') {
  return `${uri}`.split('/').filter(Boolean).pop() || '';
}

function install_memory_fs() {
  memory.clear();

  Directory.mockImplementation(function MockDirectory(...parts) {
    this.uri = join_uri(...parts);
    this.name = basename(this.uri);
    Object.defineProperty(this, 'exists', {
      get: () => memory.get(this.uri)?.type === 'dir',
    });
    this.create = () => {
      memory.set(this.uri, { type: 'dir' });
    };
    this.delete = () => {
      for (const uri of [...memory.keys()]) {
        if (uri === this.uri || uri.startsWith(`${this.uri}/`)) {
          memory.delete(uri);
        }
      }
    };
    this.list = () => {
      const prefix = `${this.uri}/`;
      const children = [];

      for (const uri of memory.keys()) {
        if (!uri.startsWith(prefix)) {
          continue;
        }

        const rest = uri.slice(prefix.length);

        if (!rest || rest.includes('/')) {
          continue;
        }

        const entry = memory.get(uri);

        if (entry?.type === 'dir') {
          children.push(new Directory(uri));
        } else {
          children.push(new File(uri));
        }
      }

      return children;
    };
  });

  File.mockImplementation(function MockFile(...parts) {
    this.uri = join_uri(...parts);
    this.name = basename(this.uri);
    this.extension = this.name.includes('.') ? `.${this.name.split('.').pop()}` : '';
    Object.defineProperty(this, 'exists', {
      get: () => memory.get(this.uri)?.type === 'file',
    });
    Object.defineProperty(this, 'size', {
      get: () => memory.get(this.uri)?.size || 0,
    });
    this.write = (content) => {
      const body = typeof content === 'string' ? content : `${content || ''}`;
      memory.set(this.uri, { content: body, size: body.length, type: 'file' });
    };
    this.textSync = () => memory.get(this.uri)?.content || '';
    this.delete = () => {
      memory.delete(this.uri);
    };
    this.move = async (destination) => {
      const current = memory.get(this.uri);

      if (!current || current.type !== 'file') {
        throw new Error('Source file is missing.');
      }

      memory.set(destination.uri, current);
      memory.delete(this.uri);
    };
    this.copy = async (destination) => {
      const current = memory.get(this.uri);

      if (!current || current.type !== 'file') {
        throw new Error('Source file is missing.');
      }

      memory.set(destination.uri, { ...current });
    };
  });
}

describe('narration_draft_id', () => {
  test('turns a post uid into a filesystem-safe folder name', () => {
    expect(narration_draft_id('12345')).toBe('12345');
    expect(narration_draft_id('https://example.micro.blog/2026/hello')).toBe(
      'https-example-micro-blog-2026-hello',
    );
    expect(narration_draft_id('  /weird uid!  ')).toBe('weird-uid');
    expect(narration_draft_id('')).toBe('');
  });
});

describe('download_remote_audio', () => {
  beforeEach(() => {
    File.mockReset();
    File.downloadFileAsync = jest.fn();
  });

  test('returns local file URIs without downloading', async () => {
    await expect(download_remote_audio('file:///tmp/take.m4a')).resolves.toBe(
      'file:///tmp/take.m4a',
    );
    expect(File.downloadFileAsync).not.toHaveBeenCalled();
  });

  test('downloads https audio into the cache directory', async () => {
    File.mockImplementation(function MockFile(_parent, name) {
      this.uri = `file:///cache/${name}`;
    });
    File.downloadFileAsync.mockImplementation(async (_url, destination) => destination);

    const uri = await download_remote_audio('https://cdn.example/read.m4a');

    expect(File.downloadFileAsync).toHaveBeenCalledWith(
      'https://cdn.example/read.m4a',
      expect.objectContaining({ uri: expect.stringMatching(/^file:\/\/\/cache\/narration-source-/) }),
      { idempotent: true },
    );
    expect(uri).toMatch(/^file:\/\/\/cache\/narration-source-.+\.m4a$/);
  });

  test('requires an audio URL', async () => {
    await expect(download_remote_audio('')).rejects.toThrow(
      'A narration audio URL is required.',
    );
  });
});

describe('narration draft files', () => {
  beforeEach(() => {
    Directory.mockReset();
    File.mockReset();
    install_memory_fs();
    memory.set('file:///tmp/take.m4a', { content: 'audio-one', size: 9, type: 'file' });
    memory.set('file:///tmp/take-2.m4a', { content: 'audio-two', size: 9, type: 'file' });
  });

  test('create_narration_draft stores the first clip and draft metadata', async () => {
    const snapshot = await create_narration_draft({
      duration_seconds: 12,
      post_uid: '3',
      source_uri: 'file:///tmp/take.m4a',
      waveform: [0.2, 0.8],
    });

    expect(snapshot).toMatchObject({
      clips: ['segment-1.m4a'],
      duration_seconds: 12,
      folder_uri: 'file:///documents/narrations/3/',
      post_uid: '3',
    });
    expect(snapshot.clip_meta[0]).toMatchObject({
      duration_seconds: 12,
      name: 'segment-1.m4a',
      waveform: [0.2, 0.8],
    });
    expect(memory.get('file:///documents/narrations/3/segment-1.m4a')?.content).toBe('audio-one');
    expect(memory.has('file:///tmp/take.m4a')).toBe(false);
  });

  test('append_clip_to_narration adds the next segment name', async () => {
    await create_narration_draft({
      duration_seconds: 12,
      post_uid: '3',
      source_uri: 'file:///tmp/take.m4a',
      waveform: [0.2],
    });

    const snapshot = await append_clip_to_narration('3', 'file:///tmp/take-2.m4a', 4, [0.1]);

    expect(snapshot.clips).toEqual(['segment-1.m4a', 'segment-2.m4a']);
    expect(snapshot.duration_seconds).toBe(16);
    expect(memory.get('file:///documents/narrations/3/segment-2.m4a')?.content).toBe('audio-two');
  });

  test('replace_narration_clips prunes files that are no longer referenced', async () => {
    await create_narration_draft({
      duration_seconds: 12,
      post_uid: '3',
      source_uri: 'file:///tmp/take.m4a',
      waveform: [0.2],
    });
    await append_clip_to_narration('3', 'file:///tmp/take-2.m4a', 4, [0.1]);

    const snapshot = await replace_narration_clips('3', [
      {
        duration_seconds: 4,
        name: 'segment-2.m4a',
        waveform: [0.1],
      },
    ]);

    expect(snapshot.clips).toEqual(['segment-2.m4a']);
    expect(memory.has('file:///documents/narrations/3/segment-1.m4a')).toBe(false);
    expect(memory.has('file:///documents/narrations/3/segment-2.m4a')).toBe(true);
  });

  test('replace_narration_clips refuses an empty clip list', async () => {
    await create_narration_draft({
      duration_seconds: 12,
      post_uid: '3',
      source_uri: 'file:///tmp/take.m4a',
      waveform: [0.2],
    });

    await expect(replace_narration_clips('3', [])).rejects.toThrow(
      'Narration needs at least one segment.',
    );
    expect(memory.has('file:///documents/narrations/3/segment-1.m4a')).toBe(true);
  });

  test('copy_narration_take writes a cache copy without removing the source', async () => {
    await create_narration_draft({
      duration_seconds: 12,
      post_uid: '3',
      source_uri: 'file:///tmp/take.m4a',
      waveform: [0.2],
    });

    const copied_uri = await copy_narration_take(
      'file:///documents/narrations/3/segment-1.m4a',
    );

    expect(copied_uri).toMatch(/^file:\/\/\/cache\/narration-take-.+\.m4a$/);
    expect(memory.get(copied_uri)?.content).toBe('audio-one');
    expect(memory.has('file:///documents/narrations/3/segment-1.m4a')).toBe(true);
  });

  test('delete_narration_draft removes the working folder', async () => {
    await create_narration_draft({
      duration_seconds: 12,
      post_uid: '3',
      source_uri: 'file:///tmp/take.m4a',
      waveform: [0.2],
    });

    delete_narration_draft('3');

    expect(memory.has('file:///documents/narrations/3')).toBe(false);
    expect(memory.has('file:///documents/narrations/3/segment-1.m4a')).toBe(false);
  });
});
