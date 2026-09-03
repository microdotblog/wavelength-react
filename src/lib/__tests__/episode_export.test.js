const mock_files = new Map();

function mock_join_uri(...parts) {
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

jest.mock('expo-file-system', () => ({
  File: jest.fn(function MockFile(...parts) {
    this.uri = mock_join_uri(...parts);
    Object.defineProperty(this, 'exists', {
      get: () => mock_files.has(this.uri),
    });
    this.copy = jest.fn(async destination => {
      if (!mock_files.has(this.uri)) {
        throw new Error('Source file is missing.');
      }

      mock_files.set(destination.uri, mock_files.get(this.uri));
    });
    this.delete = jest.fn(() => {
      mock_files.delete(this.uri);
    });
  }),
  Paths: { cache: { uri: 'file:///cache' } },
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => {}),
}));

const { File } = require('expo-file-system');
const Sharing = require('expo-sharing');
const {
  prepare_episode_share_file,
  sanitize_export_filename,
  share_episode_audio,
} = require('../episode_export');

function seed_file(uri, contents = 'audio') {
  mock_files.set(uri, contents);
}

describe('sanitize_export_filename', () => {
  test('falls back to Episode.m4a for empty or whitespace titles', () => {
    expect(sanitize_export_filename('')).toBe('Episode.m4a');
    expect(sanitize_export_filename('   ')).toBe('Episode.m4a');
  });

  test('strips slashes and reserved characters', () => {
    expect(sanitize_export_filename('News / Notes: "live"?')).toBe('News Notes live.m4a');
  });

  test('preserves unicode titles', () => {
    expect(sanitize_export_filename('Café 录音')).toBe('Café 录音.m4a');
  });

  test('collapses whitespace and trims dots', () => {
    expect(sanitize_export_filename('  Morning  show.  ')).toBe('Morning show.m4a');
  });

  test('caps long titles', () => {
    const filename = sanitize_export_filename('A'.repeat(120));

    expect(filename.endsWith('.m4a')).toBe(true);
    expect(filename.length).toBe(84);
  });
});

describe('prepare_episode_share_file', () => {
  const source_uri = 'file:///episodes/ep-1/exported.m4a';

  beforeEach(() => {
    mock_files.clear();
    File.mockClear();
  });

  test('copies the source to a titled cache file', async () => {
    seed_file(source_uri);

    const payload = await prepare_episode_share_file(source_uri, 'Morning Show');

    expect(payload).toEqual({
      UTI: 'public.mpeg-4-audio',
      dialogTitle: 'Morning Show',
      mimeType: 'audio/mp4',
      uri: 'file:///cache/Morning Show.m4a',
    });
    expect(mock_files.get('file:///cache/Morning Show.m4a')).toBe('audio');
    expect(File.mock.instances[0].copy).toHaveBeenCalledWith(
      expect.objectContaining({ uri: 'file:///cache/Morning Show.m4a' }),
      { overwrite: true },
    );
  });

  test('uses Episode.m4a and Episode as the share title when the episode name is empty', async () => {
    seed_file(source_uri);

    await expect(prepare_episode_share_file(source_uri, '   ')).resolves.toEqual({
      UTI: 'public.mpeg-4-audio',
      dialogTitle: 'Episode',
      mimeType: 'audio/mp4',
      uri: 'file:///cache/Episode.m4a',
    });
  });

  test('overwrites an existing cache file with the same name', async () => {
    seed_file(source_uri, 'fresh');
    seed_file('file:///cache/Morning Show.m4a', 'stale');

    const payload = await prepare_episode_share_file(source_uri, 'Morning Show');

    expect(payload.uri).toBe('file:///cache/Morning Show.m4a');
    expect(mock_files.get(payload.uri)).toBe('fresh');
  });

  test('requires an existing source file', async () => {
    await expect(prepare_episode_share_file('', 'Morning Show'))
      .rejects
      .toThrow('Could not prepare audio.');

    await expect(prepare_episode_share_file(source_uri, 'Morning Show'))
      .rejects
      .toThrow('Could not prepare audio.');
  });
});

describe('share_episode_audio', () => {
  const source_uri = 'file:///episodes/ep-1/exported.m4a';

  beforeEach(() => {
    mock_files.clear();
    Sharing.isAvailableAsync.mockReset();
    Sharing.shareAsync.mockReset();
    Sharing.isAvailableAsync.mockResolvedValue(true);
    Sharing.shareAsync.mockResolvedValue();
  });

  test('shares the titled cache file', async () => {
    seed_file(source_uri);

    await share_episode_audio(source_uri, 'Morning Show');

    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      'file:///cache/Morning Show.m4a',
      {
        UTI: 'public.mpeg-4-audio',
        dialogTitle: 'Morning Show',
        mimeType: 'audio/mp4',
      },
    );
  });

  test('throws when sharing is unavailable', async () => {
    seed_file(source_uri);
    Sharing.isAvailableAsync.mockResolvedValue(false);

    await expect(share_episode_audio(source_uri, 'Morning Show'))
      .rejects
      .toThrow('Sharing is not available on this device.');
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });
});
