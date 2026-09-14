export function narration_session_mode(recording_phase = 'idle') {
  if (recording_phase === 'recording' || recording_phase === 'paused') {
    return 'recording';
  }

  return 'playback';
}

export function should_resume_narration_playback({
  is_loaded = false,
  pending_play = false,
  playing = false,
} = {}) {
  return is_loaded && pending_play && !playing;
}
