import {
  EPISODE_UPLOAD_MAX_BYTES,
  build_upload_size_limit_message,
  format_file_size,
  is_over_upload_limit,
  sanitize_size_bytes,
} from '../episode_upload_size';

describe('episode_upload_size', () => {
  test('sanitize_size_bytes rejects invalid values', () => {
    expect(sanitize_size_bytes(1024)).toBe(1024);
    expect(sanitize_size_bytes(0)).toBe(0);
    expect(sanitize_size_bytes(-1)).toBe(0);
    expect(sanitize_size_bytes('12')).toBe(0);
  });

  test('format_file_size renders megabytes with one decimal under 10 MB', () => {
    expect(format_file_size(5_400_000)).toBe('5.4 MB');
    expect(format_file_size(0)).toBe('0 MB');
  });

  test('format_file_size rounds whole megabytes at 10 MB or more', () => {
    expect(format_file_size(10_200_000)).toBe('10 MB');
    expect(format_file_size(82_300_000)).toBe('82 MB');
  });

  test('is_over_upload_limit compares against the shared 75 MB cap', () => {
    expect(is_over_upload_limit(EPISODE_UPLOAD_MAX_BYTES)).toBe(false);
    expect(is_over_upload_limit(EPISODE_UPLOAD_MAX_BYTES + 1)).toBe(true);
  });

  test('build_upload_size_limit_message includes the actual size and limit', () => {
    expect(build_upload_size_limit_message(82_300_000))
      .toBe('This episode is 82 MB. Micro.blog uploads must be 75 MB or smaller.');
  });
});
