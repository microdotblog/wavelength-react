export function build_recording_live_activity_props({
  duration_ms = 0,
  now_ms = Date.now(),
  phase = 'recording',
} = {}) {
  const safe_duration = Number.isFinite(duration_ms) ? Math.max(0, duration_ms) : 0;
  const timer_start_ms = now_ms - safe_duration;

  if (phase === 'paused') {
    return {
      pauseTimeMs: now_ms,
      phase: 'paused',
      statusLabel: 'Paused',
      timerStartMs: timer_start_ms,
    };
  }

  return {
    pauseTimeMs: null,
    phase: 'recording',
    statusLabel: 'Recording',
    timerStartMs: timer_start_ms,
  };
}
