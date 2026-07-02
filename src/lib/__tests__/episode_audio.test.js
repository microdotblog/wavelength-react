jest.mock('expo-file-system', () => ({
  File: jest.fn(),
}));

jest.mock('../EpisodeStorage', () => ({
  get_episode_clip_uri: jest.fn(),
  get_exported_clip_uri: jest.fn(),
}));

jest.mock('@siteed/audio-studio', () => ({
  trimAudio: jest.fn(),
}));

jest.mock('react-native-audio-api', () => ({
  concatAudioFiles: jest.fn(),
}));

const { trimAudio } = require('@siteed/audio-studio');
const { split_clip_at } = require('../episode_audio');

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