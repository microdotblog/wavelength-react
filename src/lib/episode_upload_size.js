export const EPISODE_UPLOAD_MAX_BYTES = 75 * 1000 * 1000;

const BYTES_PER_MEGABYTE = 1000 * 1000;

export function sanitize_size_bytes(value) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function format_file_size(size_bytes = 0) {
  const safe_bytes = sanitize_size_bytes(size_bytes);

  if (safe_bytes <= 0) {
    return '0 MB';
  }

  const megabytes = safe_bytes / BYTES_PER_MEGABYTE;

  if (megabytes >= 10) {
    return `${Math.round(megabytes)} MB`;
  }

  return `${megabytes.toFixed(1)} MB`;
}

export function is_over_upload_limit(size_bytes = 0) {
  return sanitize_size_bytes(size_bytes) > EPISODE_UPLOAD_MAX_BYTES;
}

export function build_upload_size_limit_message(size_bytes = 0) {
  const formatted_size = format_file_size(size_bytes);
  const formatted_limit = format_file_size(EPISODE_UPLOAD_MAX_BYTES);

  return `This episode is ${formatted_size}. Micro.blog uploads must be ${formatted_limit} or smaller.`;
}
