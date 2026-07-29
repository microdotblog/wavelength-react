jest.mock('expo-file-system', () => ({
  File: jest.fn(() => ({
    delete: jest.fn(),
    exists: false,
  })),
}));

jest.mock('../EpisodeStorage', () => ({
  get_episode_clip_uri: jest.fn(),
  get_exported_clip_uri: jest.fn(),
}));

jest.mock('@siteed/audio-studio', () => ({
  extractPreviewBars: jest.fn(),
  trimAudio: jest.fn(),
}));

jest.mock('react-native-audio-api', () => ({
  concatAudioFiles: jest.fn(),
}));

jest.mock('../../../modules/wavelength-mp3/src/WavelengthMP3Module', () => ({
  __esModule: true,
  default: {
    exportM4aAsync: jest.fn(),
    exportMp3Async: jest.fn(),
  },
}));

const { extractPreviewBars, trimAudio } = require('@siteed/audio-studio');
const { concatAudioFiles } = require('react-native-audio-api');
const WavelengthMP3Module = require('../../../modules/wavelength-mp3/src/WavelengthMP3Module').default;
const {
  get_episode_clip_uri,
  get_exported_clip_uri,
} = require('../EpisodeStorage');
const {
  export_episode_mp3,
  merge_episode_clips,
  normalize_imported_audio,
  split_clip_at,
} = require('../episode_audio');

describe('export_episode_mp3', () => {
  beforeEach(() => {
    WavelengthMP3Module.exportMp3Async.mockReset();
  });

  test('exports a sibling MP3 file through the native encoder', async () => {
    WavelengthMP3Module.exportMp3Async.mockResolvedValue(
      'file:///episodes/episode-1/exported.mp3',
    );

    await expect(
      export_episode_mp3('file:///episodes/episode-1/exported.m4a'),
    ).resolves.toBe('file:///episodes/episode-1/exported.mp3');

    expect(WavelengthMP3Module.exportMp3Async).toHaveBeenCalledWith(
      'file:///episodes/episode-1/exported.m4a',
      'file:///episodes/episode-1/exported.mp3',
    );
  });

  test('requires an exported episode URI', async () => {
    await expect(export_episode_mp3(''))
      .rejects
      .toThrow('An exported episode is required to create an MP3.');
  });
});

describe('normalize_imported_audio', () => {
  beforeEach(() => {
    extractPreviewBars.mockReset();
    trimAudio.mockReset();
    WavelengthMP3Module.exportM4aAsync.mockReset();
  });

  test('analyzes and converts the complete file to recording-compatible AAC', async () => {
    extractPreviewBars.mockResolvedValue({
      bars: [
        { amplitude: 0.2 },
        { amplitude: 0.8 },
      ],
      durationMs: 5000,
    });
    trimAudio.mockResolvedValue({
      durationMs: 5000,
      uri: 'file:///tmp/imported.aac',
    });
    WavelengthMP3Module.exportM4aAsync.mockResolvedValue(
      'file:///tmp/imported.m4a',
    );

    await expect(normalize_imported_audio('file:///tmp/source.mp3')).resolves.toEqual({
      duration_seconds: 5,
      uri: 'file:///tmp/imported.m4a',
      waveform: [0.2, 0.8],
    });

    expect(extractPreviewBars).toHaveBeenCalledWith(expect.objectContaining({
      fileUri: 'file:///tmp/source.mp3',
      numberOfBars: 128,
      startTimeMs: 0,
    }));
    expect(trimAudio).toHaveBeenCalledWith(expect.objectContaining({
      endTimeMs: 5000,
      fileUri: 'file:///tmp/source.mp3',
      mode: 'single',
      outputFormat: {
        bitrate: 128000,
        channels: 2,
        format: 'aac',
        sampleRate: 44100,
      },
      startTimeMs: 0,
    }));
    expect(WavelengthMP3Module.exportM4aAsync).toHaveBeenCalledWith(
      'file:///tmp/imported.aac',
      'file:///tmp/imported.m4a',
    );
  });

  test('rejects files without audio before attempting conversion', async () => {
    extractPreviewBars.mockResolvedValue({
      bars: [],
      durationMs: 0,
    });

    await expect(normalize_imported_audio('file:///tmp/empty.mp3'))
      .rejects
      .toThrow('That file does not contain any audio.');

    expect(trimAudio).not.toHaveBeenCalled();
  });
});

describe('merge_episode_clips', () => {
  beforeEach(() => {
    concatAudioFiles.mockReset();
    get_episode_clip_uri.mockReset();
    get_exported_clip_uri.mockReset();
    WavelengthMP3Module.exportM4aAsync.mockReset();
  });

  test('merges stored M4A clips directly', async () => {
    const episode = {
      clips: ['segment-1.m4a', 'segment-2.m4a'],
      folder_uri: 'file:///episodes/episode-1/',
    };
    get_episode_clip_uri.mockImplementation(
      (_episode, clip_name) => `file:///episodes/episode-1/${clip_name}`,
    );
    get_exported_clip_uri.mockReturnValue(
      'file:///episodes/episode-1/exported.m4a',
    );
    concatAudioFiles.mockResolvedValue(
      'file:///episodes/episode-1/exported.m4a',
    );

    await expect(merge_episode_clips(episode)).resolves.toBe(
      'file:///episodes/episode-1/exported.m4a',
    );

    expect(WavelengthMP3Module.exportM4aAsync).not.toHaveBeenCalled();
    expect(concatAudioFiles).toHaveBeenCalledWith(
      [
        'file:///episodes/episode-1/segment-1.m4a',
        'file:///episodes/episode-1/segment-2.m4a',
      ],
      'file:///episodes/episode-1/exported.m4a',
    );
  });
});

describe('split_clip_at', () => {
  beforeEach(() => {
    trimAudio.mockReset();
    WavelengthMP3Module.exportM4aAsync.mockReset();
    trimAudio
      .mockResolvedValueOnce({ durationMs: 3000, uri: 'file:///tmp/split-1.aac' })
      .mockResolvedValueOnce({ durationMs: 7000, uri: 'file:///tmp/split-2.aac' });
    WavelengthMP3Module.exportM4aAsync
      .mockResolvedValueOnce('file:///tmp/split-1.m4a')
      .mockResolvedValueOnce('file:///tmp/split-2.m4a');
  });

  test('passes endTimeMs for both trim calls', async () => {
    await expect(
      split_clip_at('file:///episodes/segment-1.m4a', 3, 10),
    ).resolves.toEqual({
      first_seconds: 3,
      first_uri: 'file:///tmp/split-1.m4a',
      second_seconds: 7,
      second_uri: 'file:///tmp/split-2.m4a',
    });

    expect(trimAudio).toHaveBeenCalledTimes(2);
    expect(trimAudio.mock.calls[0][0]).toMatchObject({
      endTimeMs: 3000,
      fileUri: 'file:///episodes/segment-1.m4a',
      mode: 'single',
      outputFormat: {
        bitrate: 128000,
        channels: 2,
        format: 'aac',
        sampleRate: 44100,
      },
      startTimeMs: 0,
    });
    expect(trimAudio.mock.calls[1][0]).toMatchObject({
      endTimeMs: 10000,
      fileUri: 'file:///episodes/segment-1.m4a',
      mode: 'single',
      outputFormat: {
        bitrate: 128000,
        channels: 2,
        format: 'aac',
        sampleRate: 44100,
      },
      startTimeMs: 3000,
    });
    expect(WavelengthMP3Module.exportM4aAsync).toHaveBeenNthCalledWith(
      1,
      'file:///tmp/split-1.aac',
      'file:///tmp/split-1.m4a',
    );
    expect(WavelengthMP3Module.exportM4aAsync).toHaveBeenNthCalledWith(
      2,
      'file:///tmp/split-2.aac',
      'file:///tmp/split-2.m4a',
    );
  });

  test('rejects when the split point is at or past the clip duration', async () => {
    await expect(split_clip_at('file:///episodes/segment-1.m4a', 10, 10))
      .rejects
      .toThrow('Split point must be before the end of the clip.');

    expect(trimAudio).not.toHaveBeenCalled();
  });

  test('requires a source clip uri', async () => {
    await expect(split_clip_at('', 3, 10))
      .rejects
      .toThrow('A source clip is required to split.');
  });
});
