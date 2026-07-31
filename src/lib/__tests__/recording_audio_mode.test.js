jest.mock('expo-audio', () => ({
  requestNotificationPermissionsAsync: jest.fn(async () => ({ granted: true })),
  setAudioModeAsync: jest.fn(async () => {}),
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

const {
  requestNotificationPermissionsAsync,
  setAudioModeAsync,
} = require('expo-audio');
const { Platform } = require('react-native');
const { enable_recording_audio_mode } = require('../recording_audio_mode');

describe('enable_recording_audio_mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'ios';
  });

  test('enables recording and background capture on iOS without notification permission', async () => {
    await enable_recording_audio_mode();

    expect(requestNotificationPermissionsAsync).not.toHaveBeenCalled();
    expect(setAudioModeAsync).toHaveBeenCalledWith({
      allowsBackgroundRecording: true,
      allowsRecording: true,
      playsInSilentMode: true,
    });
  });

  test('requests notification permission on Android before enabling recording mode', async () => {
    Platform.OS = 'android';
    requestNotificationPermissionsAsync.mockResolvedValueOnce({ granted: true });

    await enable_recording_audio_mode();

    expect(requestNotificationPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(setAudioModeAsync).toHaveBeenCalledWith({
      allowsBackgroundRecording: true,
      allowsRecording: true,
      playsInSilentMode: true,
    });
  });

  test('falls back to foreground-only recording when Android notification permission is denied', async () => {
    Platform.OS = 'android';
    requestNotificationPermissionsAsync.mockResolvedValueOnce({ granted: false });

    await enable_recording_audio_mode();

    expect(setAudioModeAsync).toHaveBeenCalledWith({
      allowsBackgroundRecording: false,
      allowsRecording: true,
      playsInSilentMode: true,
    });
  });
});
