const {
  merge_episode_waveform,
  slice_waveform,
} = require('../merge_episode_waveform');

describe('merge_episode_waveform', () => {
  test('returns empty array for no clips or zero total duration', () => {
    expect(merge_episode_waveform([])).toEqual([]);
    expect(merge_episode_waveform([
      { duration_seconds: 0, waveform: [1] },
    ])).toEqual([]);
  });

  test('weights longer clips across more output buckets', () => {
    const merged = merge_episode_waveform([
      { duration_seconds: 10, waveform: [0.2, 0.4] },
      { duration_seconds: 30, waveform: [0.8, 1] },
    ], 4);

    expect(merged).toHaveLength(4);
    expect(Math.max(...merged.slice(0, 1))).toBeLessThanOrEqual(0.4);
    expect(Math.max(...merged.slice(1))).toBeGreaterThanOrEqual(0.8);
  });

  test('changes shape when clip order changes', () => {
    const first_order = merge_episode_waveform([
      { duration_seconds: 20, waveform: [1, 0] },
      { duration_seconds: 10, waveform: [0, 1] },
    ], 4);
    const second_order = merge_episode_waveform([
      { duration_seconds: 10, waveform: [0, 1] },
      { duration_seconds: 20, waveform: [1, 0] },
    ], 4);

    expect(first_order).not.toEqual(second_order);
  });

  test('preserves peak values within each clip span', () => {
    const merged = merge_episode_waveform([
      { duration_seconds: 5, waveform: [0.9] },
    ], 2);

    expect(merged).toEqual([0.9, 0.9]);
  });
});

describe('slice_waveform', () => {
  test('returns empty array for missing waveform input', () => {
    expect(slice_waveform()).toEqual([]);
    expect(slice_waveform([])).toEqual([]);
  });

  test('partitions a waveform at the requested fractions', () => {
    const waveform = [0, 0.25, 0.5, 0.75, 1];
    const first_half = slice_waveform(waveform, 0, 0.5);
    const second_half = slice_waveform(waveform, 0.5, 1);

    expect(first_half.length).toBeGreaterThan(0);
    expect(second_half.length).toBeGreaterThan(0);
    expect(first_half[0]).toBe(0);
    expect(second_half[second_half.length - 1]).toBe(1);
  });

  test('clamps invalid fractions', () => {
    expect(slice_waveform([0.2, 0.8], -1, 2)).toEqual([0.2, 0.8]);
    expect(slice_waveform([0.2, 0.8], 0.8, 0.2)).toEqual([0.8]);
  });
});
