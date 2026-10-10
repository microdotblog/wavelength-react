import { Platform } from 'react-native';
import {
  IOSOutputFormat,
  RecordingPresets,
  requestNotificationPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';

export function get_recording_options() {
  const options = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true };

  if (Platform.OS === 'ios') {
    options.ios = {
      ...options.ios,
      bitDepthHint: 16,
      outputFormat: IOSOutputFormat.APPLELOSSLESS,
    };
  }

  return options;
}

export async function enable_recording_audio_mode() {
  // Android needs a notification for the microphone foreground service.
  // If the user denies it, still allow foreground recording without background capture.
  let allows_background_recording = true;

  if (Platform.OS === 'android') {
    const notification = await requestNotificationPermissionsAsync();
    allows_background_recording = notification?.granted === true;
  }

  await setAudioModeAsync({
    allowsBackgroundRecording: allows_background_recording,
    allowsRecording: true,
    playsInSilentMode: true,
  });
}
