const { safe_player_side_effect } = require('../safe_player_side_effect');

describe('safe_player_side_effect', () => {
  test('runs player actions safely', () => {
    const action = jest.fn();

    expect(safe_player_side_effect({ id: 'player' }, action)).toBe(true);
    expect(action).toHaveBeenCalledTimes(1);
  });

  test('ignores missing players or actions', () => {
    const action = jest.fn();

    expect(safe_player_side_effect(null, action)).toBe(false);
    expect(safe_player_side_effect({}, null)).toBe(false);
    expect(action).not.toHaveBeenCalled();
  });

  test('swallows thrown player errors', () => {
    expect(
      safe_player_side_effect({}, () => {
        throw new Error('player unavailable');
      }),
    ).toBe(false);
  });
});