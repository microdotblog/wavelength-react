const { build_recording_live_activity_props } = require('../recording_live_activity_props');

describe('build_recording_live_activity_props', () => {
  test('builds a live count-up timer for an active recording', () => {
    expect(
      build_recording_live_activity_props({
        duration_ms: 12_500,
        now_ms: 1_000_000,
        phase: 'recording',
      }),
    ).toEqual({
      pauseTimeMs: null,
      phase: 'recording',
      statusLabel: 'Recording',
      timerStartMs: 987_500,
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
      pauseTimeMs: 2_000_000,
      phase: 'paused',
      statusLabel: 'Paused',
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
      pauseTimeMs: null,
      phase: 'recording',
      statusLabel: 'Recording',
      timerStartMs: 5000,
    });
  });
});
