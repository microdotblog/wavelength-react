export const WAVEFORM_SAMPLE_COUNT = 128;

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

// Stretch stored peaks to however many bars fit on screen so playback waveforms
// stay smooth even when older episodes only saved a handful of samples.
export function upsample_waveform_levels(waveform = [], target_count) {
  const safe_waveform = Array.isArray(waveform) ? waveform.map(clamp_unit) : [];
  const count = Math.max(1, Math.floor(target_count));

  if (safe_waveform.length === 0) {
    return [];
  }

  if (safe_waveform.length === 1 || count === 1) {
    return new Array(count).fill(safe_waveform[0]);
  }

  if (safe_waveform.length >= count) {
    return downsample_waveform(safe_waveform, count);
  }

  const last_index = safe_waveform.length - 1;
  const result = new Array(count);

  for (let index = 0; index < count; index += 1) {
    const position = (index / (count - 1)) * last_index;
    const lower = Math.floor(position);
    const upper = Math.min(lower + 1, last_index);
    const mix = position - lower;
    result[index] = clamp_unit(safe_waveform[lower] * (1 - mix) + safe_waveform[upper] * mix);
  }

  return result;
}
