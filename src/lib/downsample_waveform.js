export const WAVEFORM_SAMPLE_COUNT = 48;

function clamp_unit(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
}

// Compress a long stream of recording levels into a fixed set of peaks so the
// stored waveform stays small and renders the same regardless of clip length.
export function downsample_waveform(samples = [], target_count = WAVEFORM_SAMPLE_COUNT) {
  const safe_samples = Array.isArray(samples) ? samples.filter(Number.isFinite) : [];
  const count = Math.max(1, Math.floor(target_count));

  if (safe_samples.length === 0) {
    return [];
  }

  if (safe_samples.length <= count) {
    return safe_samples.map(clamp_unit);
  }

  const bucket_size = safe_samples.length / count;
  const result = new Array(count);

  for (let index = 0; index < count; index += 1) {
    const start = Math.floor(index * bucket_size);
    const end = Math.max(start + 1, Math.floor((index + 1) * bucket_size));
    let peak = 0;

    for (let cursor = start; cursor < end; cursor += 1) {
      const value = clamp_unit(safe_samples[cursor]);

      if (value > peak) {
        peak = value;
      }
    }

    result[index] = peak;
  }

  return result;
}
