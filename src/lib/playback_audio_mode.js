import { setAudioModeAsync, setIsAudioActiveAsync } from 'expo-audio';

export async function enable_playback_audio_mode() {
  await setIsAudioActiveAsync(true);
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

export async function reset_stale_playback_on_start() {
  await setIsAudioActiveAsync(false);
  await disable_playback_audio_mode();
}