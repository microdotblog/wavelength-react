function format_clock_parts(total_seconds = 0) {
  const safe_seconds = Number.isFinite(total_seconds) ? Math.max(total_seconds, 0) : 0;
  const whole_seconds = Math.floor(safe_seconds);
  const minutes = Math.floor(whole_seconds / 60);
  const seconds = whole_seconds % 60;

  return {
    minutes,
    seconds,
  };
}

export function format_duration(total_seconds = 0) {
  const { minutes, seconds } = format_clock_parts(total_seconds);
  const padded_seconds = `${seconds}`.padStart(2, '0');

  return `${minutes}:${padded_seconds}`;
}

export function format_clock(total_millis = 0) {
  return format_duration(total_millis / 1000);
}
