jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

const mock_download = jest.fn();
const mock_file_instances = [];

jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation((directory, name) => {
    const base = `${directory}`.replace(/\/$/, '');
    const instance = {
      exists: false,
      uri: `${base}/${name}`,
    };
    mock_file_instances.push(instance);
    return instance;
  }),
}));

jest.mock('expo-widgets', () => ({
  widgetsDirectory: 'file:///shared/ExpoWidgets',
}));

const { File } = require('expo-file-system');
File.downloadFileAsync = mock_download;

const { Platform } = require('react-native');
const {
  preload_discover_playback_artwork,
} = require('../preload_discover_playback_artwork');

describe('preload_discover_playback_artwork', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'ios';
    mock_file_instances.length = 0;
    mock_download.mockImplementation(async (_url, destination) => destination);
  });

  test('downloads artwork into the widgets shared directory', async () => {
    const uri = await preload_discover_playback_artwork({
      artwork_url: 'https://example.com/cover.jpg',
      post_id: '123',
    });

    expect(File).toHaveBeenCalledWith(
      'file:///shared/ExpoWidgets',
      expect.stringMatching(/^discover-artwork-123-[0-9a-f]+$/),
    );
    expect(mock_download).toHaveBeenCalledWith(
      'https://example.com/cover.jpg',
      expect.objectContaining({
        uri: expect.stringMatching(/^file:\/\/\/shared\/ExpoWidgets\/discover-artwork-123-/),
      }),
      { idempotent: true },
    );
    expect(uri).toMatch(/^file:\/\/\/shared\/ExpoWidgets\/discover-artwork-123-/);
  });

  test('reuses an already-downloaded artwork file', async () => {
    File.mockImplementationOnce((directory, name) => {
      const base = `${directory}`.replace(/\/$/, '');
      return {
        exists: true,
        uri: `${base}/${name}`,
      };
    });

    const uri = await preload_discover_playback_artwork({
      artwork_url: 'https://example.com/cover.jpg',
      post_id: 'abc',
    });

    expect(mock_download).not.toHaveBeenCalled();
    expect(uri).toMatch(/^file:\/\/\/shared\/ExpoWidgets\/discover-artwork-abc-/);
  });

  test('returns empty string when artwork is missing', async () => {
    await expect(
      preload_discover_playback_artwork({
        artwork_url: '',
        post_id: '123',
      }),
    ).resolves.toBe('');
    expect(mock_download).not.toHaveBeenCalled();
  });

  test('is a no-op on Android', async () => {
    Platform.OS = 'android';

    await expect(
      preload_discover_playback_artwork({
        artwork_url: 'https://example.com/cover.jpg',
        post_id: '123',
      }),
    ).resolves.toBe('');
    expect(mock_download).not.toHaveBeenCalled();
  });
});
