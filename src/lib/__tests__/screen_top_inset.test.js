jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

const { stack_screen_top_inset } = require('../screen_top_inset');

describe('stack_screen_top_inset', () => {
  test('returns header height on ios when available', () => {
    expect(stack_screen_top_inset({
      header_height: 96,
      top_safe_area_inset: 59,
    })).toBe(96);
  });

  test('falls back to safe area plus navigation bar when header height is missing', () => {
    expect(stack_screen_top_inset({
      header_height: 0,
      top_safe_area_inset: 59,
    })).toBe(103);
  });

  test('returns zero on android', () => {
    require('react-native').Platform.OS = 'android';

    expect(stack_screen_top_inset({
      header_height: 96,
      top_safe_area_inset: 24,
    })).toBe(0);

    require('react-native').Platform.OS = 'ios';
  });
});