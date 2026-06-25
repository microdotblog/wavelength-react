export function build_timeline(clips = []) {
  const durations = clips.map(clip => Math.max(clip?.duration_seconds || 0, 0));
  const offsets = [];
  let elapsed = 0;

  for (const duration of durations) {
    offsets.push(elapsed);
    elapsed += duration;
  }

  return {
    durations,
    offsets,
    total_duration: elapsed,
  };
}

export function index_for_time(offsets = [], durations = [], target_seconds = 0) {
  for (let index = offsets.length - 1; index >= 0; index -= 1) {
    if (target_seconds >= offsets[index]) {
      return index;
    }
  }

  return 0;
}