const {
  RECORDING_COMPACT_TIMER_WIDTH_H_MM_SS,
  RECORDING_COMPACT_TIMER_WIDTH_MM_SS,
  RECORDING_LIVE_ACTIVITY_HOUR_MS,
  build_recording_live_activity_props,
} = require('../recording_live_activity_props');

describe('build_recording_live_activity_props', () => {
  test('builds a live count-up timer for an active recording under one hour', () => {
    expect(
      build_recording_live_activity_props({
        duration_ms: 12_500,
        now_ms: 1_000_000,
        phase: 'recording',
      }),
    ).toEqual({
      compactTimerWidth: RECORDING_COMPACT_TIMER_WIDTH_MM_SS,
      pauseTimeMs: null,
      phase: 'recording',
      statusLabel: 'Recording',
      timerEndMs: 987_500 + RECORDING_LIVE_ACTIVITY_HOUR_MS - 1,
      timerStartMs: 987_500,
    });
  });

  test('widens the timer window once recording reaches one hour', () => {
    expect(
      build_recording_live_activity_props({
        duration_ms: RECORDING_LIVE_ACTIVITY_HOUR_MS,
        now_ms: 10_000_000,
        phase: 'recording',
      }),
    ).toEqual({
      compactTimerWidth: RECORDING_COMPACT_TIMER_WIDTH_H_MM_SS,
      pauseTimeMs: null,
      phase: 'recording',
      statusLabel: 'Recording',
      timerEndMs: 10_000_000 - RECORDING_LIVE_ACTIVITY_HOUR_MS + (8 * RECORDING_LIVE_ACTIVITY_HOUR_MS),
      timerStartMs: 10_000_000 - RECORDING_LIVE_ACTIVITY_HOUR_MS,
    });
  });

  test('freezes the timer when paused', () => {
    expect(
      build_recording_live_activity_props({
        duration_ms: 45_000,
        now_ms: 2_000_000,
        phase: 'paused',
      }),
    ).toEqual({
      compactTimerWidth: RECORDING_COMPACT_TIMER_WIDTH_MM_SS,
      pauseTimeMs: 2_000_000,
      phase: 'paused',
      statusLabel: 'Paused',
      timerEndMs: 1_955_000 + RECORDING_LIVE_ACTIVITY_HOUR_MS - 1,
      timerStartMs: 1_955_000,
    });
  });

  test('clamps invalid duration to zero', () => {
    expect(
      build_recording_live_activity_props({
        duration_ms: Number.NaN,
        now_ms: 5000,
        phase: 'recording',
      }),
    ).toEqual({
      compactTimerWidth: RECORDING_COMPACT_TIMER_WIDTH_MM_SS,
      pauseTimeMs: null,
      phase: 'recording',
      statusLabel: 'Recording',
      timerEndMs: 5000 + RECORDING_LIVE_ACTIVITY_HOUR_MS - 1,
      timerStartMs: 5000,
    });
  });
});
