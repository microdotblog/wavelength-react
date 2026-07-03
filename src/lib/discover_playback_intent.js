export function should_auto_resume_discover_playback({
  is_loaded = false,
  pending_play = false,
  playing = false,
  should_play = false,
} = {}) {
  return should_play && is_loaded && pending_play && !playing;
}

export function should_sync_discover_playback_intent({
  is_buffering = false,
  is_loaded = false,
  is_preparing_track = false,
  pending_play = false,
  playing = false,
  should_play = false,
} = {}) {
  if (!should_play || !is_loaded) {
    return null;
  }

  if (playing) {
    return true;
  }

  if (!is_buffering && !pending_play && !is_preparing_track) {
    return false;
  }

  return null;
}