jest.mock('expo-file-system', () => ({
  File: jest.fn(),
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
    exportMp3Async: jest.fn(),
  },
}));

const { extractPreviewBars, trimAudio } = require('@siteed/audio-studio');
const WavelengthMP3Module = require('../../../modules/wavelength-mp3/src/WavelengthMP3Module').default;
const {
  export_episode_mp3,
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

    await expect(normalize_imported_audio('file:///tmp/source.mp3')).resolves.toEqual({
      duration_seconds: 5,
      uri: 'file:///tmp/imported.aac',
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

describe('split_clip_at', () => {
  beforeEach(() => {
    trimAudio.mockReset();
    trimAudio
      .mockResolvedValueOnce({ durationMs: 3000, uri: 'file:///tmp/split-1.aac' })
      .mockResolvedValueOnce({ durationMs: 7000, uri: 'file:///tmp/split-2.aac' });
  });

  test('passes endTimeMs for both trim calls', async () => {
    await split_clip_at('file:///episodes/segment-1.m4a', 3, 10);

    expect(trimAudio).toHaveBeenCalledTimes(2);
    expect(trimAudio.mock.calls[0][0]).toMatchObject({
      endTimeMs: 3000,
      fileUri: 'file:///episodes/segment-1.m4a',
      mode: 'single',
      startTimeMs: 0,
    });
    expect(trimAudio.mock.calls[1][0]).toMatchObject({
      endTimeMs: 10000,
      fileUri: 'file:///episodes/segment-1.m4a',
      mode: 'single',
      startTimeMs: 3000,
    });
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
