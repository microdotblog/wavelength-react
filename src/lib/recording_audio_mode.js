import { Platform } from 'react-native';
import {
  requestNotificationPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';

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
