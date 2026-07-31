/**
 * When the Android foreground-service notification Stop action finishes the
 * native recorder, JS phase can lag behind. These helpers reconcile UI phase
 * with recorder / status events.
 */

export function resolve_phase_after_recorder_state({
  can_record = false,
  current_phase = 'idle',
  // Only trust "finished" after the poller has seen this take actually active.
  // Otherwise we race: UI sets phase to recording before canRecord/isRecording update.
  has_observed_active_take = false,
  is_recording = false,
  is_saving = false,
} = {}) {
  if (is_saving) {
    return current_phase;
  }

  if (current_phase !== 'recording' && current_phase !== 'paused') {
    return current_phase;
  }

  // Finished natively: not recording and no longer prepared (unlike intentional pause).
  if (has_observed_active_take && !is_recording && !can_record) {
    return 'stopped';
  }

  return current_phase;
}

export function resolve_phase_after_recording_status({
  current_phase = 'idle',
  has_error = false,
  is_finished = false,
  is_saving = false,
  media_services_did_reset = false,
  url = null,
} = {}) {
  if (is_saving || !is_finished) {
    return current_phase;
  }

  // iOS media-services reset finishes the session without a usable file.
  if (media_services_did_reset || (has_error && !url)) {
    if (current_phase === 'recording' || current_phase === 'paused') {
      return 'idle';
    }
    return current_phase;
  }

  if (current_phase === 'recording' || current_phase === 'paused') {
    return 'stopped';
  }

  return current_phase;
}

export function is_review_recording_phase(phase = 'idle') {
  return phase === 'paused' || phase === 'stopped';
}
