const { normalize_metering } = require('../normalize_metering');

describe('normalize_metering', () => {
  test('maps silence floor to zero and peak ceiling to one', () => {
    expect(normalize_metering(-60)).toBe(0);
    expect(normalize_metering(0)).toBe(1);
  });

  test('maps mid-range dB linearly', () => {
    expect(normalize_metering(-30)).toBeCloseTo(0.5);
  });

  test('returns zero for non-finite input', () => {
    expect(normalize_metering(Number.NaN)).toBe(0);
    expect(normalize_metering(Number.POSITIVE_INFINITY)).toBe(0);
  });

  test('clamps values below the floor and above the ceiling', () => {
    expect(normalize_metering(-120)).toBe(0);
    expect(normalize_metering(12)).toBe(1);
  });
});
