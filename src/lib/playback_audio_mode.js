import { setAudioModeAsync } from 'expo-audio';

export async function enable_playback_audio_mode() {
  await setAudioModeAsync({
    allowsRecording: false,
    interruptionMode: 'doNotMix',
    playsInSilentMode: true,
    shouldPlayInBackground: true,
  });
}

export async function disable_playback_audio_mode() {
  await setAudioModeAsync({
    allowsRecording: false,
    interruptionMode: 'mixWithOthers',
    playsInSilentMode: true,
    shouldPlayInBackground: false,
  });
}