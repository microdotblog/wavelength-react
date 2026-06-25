const {
  build_timeline,
  index_for_time,
} = require('../playback_timeline');

describe('playback_timeline', () => {
  test('build_timeline sums clip durations', () => {
    const timeline = build_timeline([
      { duration_seconds: 10 },
      { duration_seconds: 5 },
      { duration_seconds: 2.5 },
    ]);

    expect(timeline.total_duration).toBe(17.5);
    expect(timeline.offsets).toEqual([0, 10, 15]);
    expect(timeline.durations).toEqual([10, 5, 2.5]);
  });

  test('index_for_time finds clip index for global time', () => {
    const offsets = [0, 10, 15];
    const durations = [10, 5, 2.5];

    expect(index_for_time(offsets, durations, 0)).toBe(0);
    expect(index_for_time(offsets, durations, 10)).toBe(1);
    expect(index_for_time(offsets, durations, 16)).toBe(2);
  });
});