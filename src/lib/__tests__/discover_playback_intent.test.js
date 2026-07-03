const {
  should_auto_resume_discover_playback,
  should_sync_discover_playback_intent,
} = require('../discover_playback_intent');

describe('discover_playback_intent', () => {
  test('should_auto_resume_discover_playback only resumes pending play requests', () => {
    expect(
      should_auto_resume_discover_playback({
        is_loaded: true,
        pending_play: true,
        playing: false,
        should_play: true,
      }),
    ).toBe(true);

    expect(
      should_auto_resume_discover_playback({
        is_loaded: true,
        pending_play: false,
        playing: false,
        should_play: true,
      }),
    ).toBe(false);
  });

  test('should_sync_discover_playback_intent follows native playback state', () => {
    expect(
      should_sync_discover_playback_intent({
        is_loaded: true,
        playing: true,
        should_play: true,
      }),
    ).toBe(true);

    expect(
      should_sync_discover_playback_intent({
        is_loaded: true,
        playing: false,
        should_play: true,
      }),
    ).toBe(false);
  });
});