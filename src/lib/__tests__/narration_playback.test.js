const {
  narration_session_mode,
  should_resume_narration_playback,
} = require('../narration_playback');

describe('narration_session_mode', () => {
  test('keeps the recording session only while capturing', () => {
    expect(narration_session_mode('recording')).toBe('recording');
    expect(narration_session_mode('paused')).toBe('recording');
    expect(narration_session_mode('idle')).toBe('playback');
    expect(narration_session_mode('review')).toBe('playback');
  });
});

describe('should_resume_narration_playback', () => {
  test('plays once the player is loaded after a pending request', () => {
    expect(should_resume_narration_playback({
      is_loaded: true,
      pending_play: true,
      playing: false,
    })).toBe(true);

    expect(should_resume_narration_playback({
      is_loaded: false,
      pending_play: true,
      playing: false,
    })).toBe(false);

    expect(should_resume_narration_playback({
      is_loaded: true,
      pending_play: false,
      playing: false,
    })).toBe(false);

    expect(should_resume_narration_playback({
      is_loaded: true,
      pending_play: true,
      playing: true,
    })).toBe(false);
  });
});
