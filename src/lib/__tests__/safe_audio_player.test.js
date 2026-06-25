const { safe_audio_player_call } = require('../safe_audio_player');

describe('safe_audio_player_call', () => {
  test('skips action when player is not loaded', () => {
    const action = jest.fn();

    expect(safe_audio_player_call(false, action)).toBe(false);
    expect(action).not.toHaveBeenCalled();
  });

  test('runs action when player is loaded', () => {
    const action = jest.fn();

    expect(safe_audio_player_call(true, action)).toBe(true);
    expect(action).toHaveBeenCalledTimes(1);
  });

  test('swallows native shared object errors during teardown', () => {
    const action = jest.fn(() => {
      const error = new Error('NativeSharedObjectNotFoundException');
      error.code = 'ERR_NATIVE_SHARED_OBJECT_NOT_FOUND';
      throw error;
    });

    expect(safe_audio_player_call(true, action)).toBe(false);
    expect(action).toHaveBeenCalledTimes(1);
  });
});