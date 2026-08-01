const {
  is_review_recording_phase,
  resolve_phase_after_recorder_state,
  resolve_phase_after_recording_status,
} = require('../recording_phase_sync');

describe('resolve_phase_after_recorder_state', () => {
  test('moves recording to stopped when the native recorder is finished', () => {
    expect(
      resolve_phase_after_recorder_state({
        can_record: false,
        current_phase: 'recording',
        has_observed_active_take: true,
        is_recording: false,
      }),
    ).toBe('stopped');
  });

  test('moves paused to stopped when notification Stop finishes the take', () => {
    expect(
      resolve_phase_after_recorder_state({
        can_record: false,
        current_phase: 'paused',
        has_observed_active_take: true,
        is_recording: false,
      }),
    ).toBe('stopped');
  });

  test('does not stop while waiting for the first polled active status', () => {
    expect(
      resolve_phase_after_recorder_state({
        can_record: false,
        current_phase: 'recording',
        has_observed_active_take: false,
        is_recording: false,
      }),
    ).toBe('recording');
  });

  test('keeps recording while the native recorder is still active', () => {
    expect(
      resolve_phase_after_recorder_state({
        can_record: true,
        current_phase: 'recording',
        has_observed_active_take: true,
        is_recording: true,
      }),
    ).toBe('recording');
  });

  test('keeps paused when the recorder is still prepared', () => {
    expect(
      resolve_phase_after_recorder_state({
        can_record: true,
        current_phase: 'paused',
        has_observed_active_take: true,
        is_recording: false,
      }),
    ).toBe('paused');
  });

  test('does not change phase while saving', () => {
    expect(
      resolve_phase_after_recorder_state({
        can_record: false,
        current_phase: 'paused',
        has_observed_active_take: true,
        is_recording: false,
        is_saving: true,
      }),
    ).toBe('paused');
  });

  test('leaves idle alone before a take starts', () => {
    expect(
      resolve_phase_after_recorder_state({
        can_record: false,
        current_phase: 'idle',
        is_recording: false,
      }),
    ).toBe('idle');
  });
});

describe('resolve_phase_after_recording_status', () => {
  test('moves active phases to stopped when status is finished', () => {
    expect(
      resolve_phase_after_recording_status({
        current_phase: 'recording',
        is_finished: true,
        url: 'file:///tmp/take.m4a',
      }),
    ).toBe('stopped');

    expect(
      resolve_phase_after_recording_status({
        current_phase: 'paused',
        is_finished: true,
        url: 'file:///tmp/take.m4a',
      }),
    ).toBe('stopped');
  });

  test('resets to idle when media services reset without a usable file', () => {
    expect(
      resolve_phase_after_recording_status({
        current_phase: 'recording',
        is_finished: true,
        media_services_did_reset: true,
        url: null,
      }),
    ).toBe('idle');
  });

  test('ignores finished status during intentional save', () => {
    expect(
      resolve_phase_after_recording_status({
        current_phase: 'paused',
        is_finished: true,
        is_saving: true,
        url: 'file:///tmp/take.m4a',
      }),
    ).toBe('paused');
  });

  test('ignores unfinished status updates', () => {
    expect(
      resolve_phase_after_recording_status({
        current_phase: 'recording',
        is_finished: false,
      }),
    ).toBe('recording');
  });

  test('leaves idle and stopped alone when finished status arrives', () => {
    expect(
      resolve_phase_after_recording_status({
        current_phase: 'idle',
        is_finished: true,
      }),
    ).toBe('idle');

    expect(
      resolve_phase_after_recording_status({
        current_phase: 'stopped',
        is_finished: true,
        url: 'file:///tmp/take.m4a',
      }),
    ).toBe('stopped');
  });
});

describe('is_review_recording_phase', () => {
  test('treats paused and stopped as review phases', () => {
    expect(is_review_recording_phase('paused')).toBe(true);
    expect(is_review_recording_phase('stopped')).toBe(true);
    expect(is_review_recording_phase('recording')).toBe(false);
    expect(is_review_recording_phase('idle')).toBe(false);
  });
});
