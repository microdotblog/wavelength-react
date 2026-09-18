const {
  resolve_active_clip_index,
  resolve_playback_status_label,
} = require('../episode_playback_ui');

describe('resolve_active_clip_index', () => {
  test('highlights the current clip while playing or paused mid-take', () => {
    expect(resolve_active_clip_index({
      clip_count: 2,
      current_clip_index: 1,
      current_time: 4,
      playing: true,
      total_duration: 10,
    })).toBe(1);

    expect(resolve_active_clip_index({
      clip_count: 2,
      current_clip_index: 0,
      current_time: 2,
      playing: false,
      total_duration: 10,
    })).toBe(0);

    expect(resolve_active_clip_index({
      clip_count: 2,
      current_clip_index: 0,
      current_time: 0,
      playing: false,
      total_duration: 10,
    })).toBe(-1);
  });
});

describe('resolve_playback_status_label', () => {
  test('describes preview playback in plain language', () => {
    expect(resolve_playback_status_label({
      clip_count: 1,
      current_clip_index: 0,
      current_time: 1,
      playing: true,
      total_duration: 8,
    })).toBe('Playing preview');

    expect(resolve_playback_status_label({
      clip_count: 3,
      current_clip_index: 1,
      current_time: 4,
      playing: true,
      total_duration: 12,
    })).toBe('Playing segment 2 of 3');

    expect(resolve_playback_status_label({
      clip_count: 1,
      current_clip_index: 0,
      current_time: 3,
      playing: false,
      total_duration: 8,
    })).toBe('Paused at 0:03');

    expect(resolve_playback_status_label({
      clip_count: 1,
      current_clip_index: 0,
      current_time: 0,
      playing: false,
      total_duration: 8,
    })).toBe('Tap play to preview');
  });
});
