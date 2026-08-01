// SwiftUI shows H:MM:SS when the timer interval is ≥ 1h (expo-ui has no showsHours).
// Keep a sub-hour window while elapsed is short so the count-up stays on MM:SS.
export const RECORDING_LIVE_ACTIVITY_HOUR_MS = 60 * 60 * 1000;
const SUB_HOUR_WINDOW_MS = RECORDING_LIVE_ACTIVITY_HOUR_MS - 1;
const LONG_WINDOW_MS = 8 * RECORDING_LIVE_ACTIVITY_HOUR_MS;

// Compact DI timer widths for monospaced 12pt text.
export const RECORDING_COMPACT_TIMER_WIDTH_MM_SS = 42;
export const RECORDING_COMPACT_TIMER_WIDTH_H_MM_SS = 54;

export function build_recording_live_activity_props({
  duration_ms = 0,
  now_ms = Date.now(),
  phase = 'recording',
} = {}) {
  const safe_duration = Number.isFinite(duration_ms) ? Math.max(0, duration_ms) : 0;
  const timer_start_ms = now_ms - safe_duration;
  const uses_hours = safe_duration >= RECORDING_LIVE_ACTIVITY_HOUR_MS;
  const timer_end_ms = timer_start_ms + (uses_hours ? LONG_WINDOW_MS : SUB_HOUR_WINDOW_MS);
  const compact_timer_width = uses_hours
    ? RECORDING_COMPACT_TIMER_WIDTH_H_MM_SS
    : RECORDING_COMPACT_TIMER_WIDTH_MM_SS;

  if (phase === 'paused') {
    return {
      compactTimerWidth: compact_timer_width,
      pauseTimeMs: now_ms,
      phase: 'paused',
      statusLabel: 'Paused',
      timerEndMs: timer_end_ms,
      timerStartMs: timer_start_ms,
    };
  }

  return {
    compactTimerWidth: compact_timer_width,
    pauseTimeMs: null,
    phase: 'recording',
    statusLabel: 'Recording',
    timerEndMs: timer_end_ms,
    timerStartMs: timer_start_ms,
  };
}
