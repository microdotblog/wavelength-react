export function safe_audio_player_call(is_loaded = false, action = null) {
  if (!is_loaded || typeof action !== 'function') {
    return false;
  }

  try {
    action();
    return true;
  } catch {
    return false;
  }
}