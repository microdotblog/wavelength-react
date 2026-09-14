import { format_duration } from './format_duration';

export function resolve_active_clip_index({
  clip_count,
  current_clip_index,
  current_time,
  playing,
  total_duration,
}) {
  if (clip_count <= 0) {
    return -1;
  }

  if (playing) {
    return current_clip_index;
  }

  if (current_time > 0 && total_duration > 0 && current_time < total_duration) {
    return current_clip_index;
  }

  return -1;
}

export function resolve_playback_status_label({
  clip_count,
  current_clip_index,
  current_time,
  playing,
  total_duration,
}) {
  if (playing) {
    if (clip_count <= 1) {
      return 'Playing preview';
    }

    return `Playing segment ${current_clip_index + 1} of ${clip_count}`;
  }

  if (current_time > 0 && total_duration > 0 && current_time < total_duration) {
    return `Paused at ${format_duration(current_time)}`;
  }

  return 'Tap play to preview';
}
