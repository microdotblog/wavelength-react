jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('../../theme/wavelengthTheme', () => ({
  is_liquid_glass: jest.fn(() => false),
}));

const { Platform } = require('react-native');
const { is_liquid_glass } = require('../../theme/wavelengthTheme');
const { native_tab_bar_bottom_offset } = require('../tab_bar_inset');

describe('native_tab_bar_bottom_offset', () => {
  beforeEach(() => {
    Platform.OS = 'ios';
    is_liquid_glass.mockReturnValue(false);
  });

  test('adds Android tab bar height to the safe area inset', () => {
    Platform.OS = 'android';

    expect(native_tab_bar_bottom_offset(12)).toBe(92);
  });

  test('adds iOS tab bar height to the safe area inset', () => {
    Platform.OS = 'ios';

    expect(native_tab_bar_bottom_offset(34)).toBe(83);
  });

  test('uses liquid glass tab bar height on supported iOS builds', () => {
    Platform.OS = 'ios';
    is_liquid_glass.mockReturnValue(true);

    expect(native_tab_bar_bottom_offset(34)).toBe(90);
  });
});