import { WAVEFORM_SAMPLE_COUNT } from './downsample_waveform';

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

function sample_at(waveform, fraction) {
  if (!Array.isArray(waveform) || waveform.length === 0) {
    return 0;
  }

  const index = Math.min(waveform.length - 1, Math.floor(fraction * waveform.length));

  return clamp_unit(waveform[index]);
}

// Lay every clip's waveform onto a single timeline weighted by its duration so
// a long segment occupies proportionally more of the merged episode waveform
// than a short one, then keep the peak for each output bucket.
export function merge_episode_waveform(clip_meta = [], target_count = WAVEFORM_SAMPLE_COUNT) {
  const safe_meta = Array.isArray(clip_meta) ? clip_meta : [];
  const count = Math.max(1, Math.floor(target_count));
  const total_duration = safe_meta.reduce(
    (sum, clip) => sum + Math.max(clip?.duration_seconds || 0, 0),
    0,
  );

  if (safe_meta.length === 0 || total_duration <= 0) {
    return [];
  }

  const peaks = new Array(count).fill(0);
  let elapsed = 0;

  for (const clip of safe_meta) {
    const duration = Math.max(clip?.duration_seconds || 0, 0);

    if (duration <= 0) {
      continue;
    }

    const start_bucket = Math.floor((elapsed / total_duration) * count);
    const end_bucket = Math.min(
      count,
      Math.max(start_bucket + 1, Math.ceil(((elapsed + duration) / total_duration) * count)),
    );
    const span = end_bucket - start_bucket;

    for (let bucket = start_bucket; bucket < end_bucket; bucket += 1) {
      const local_fraction = span > 0 ? (bucket - start_bucket) / span : 0;
      const value = sample_at(clip?.waveform, local_fraction);

      if (value > peaks[bucket]) {
        peaks[bucket] = value;
      }
    }

    elapsed += duration;
  }

  return peaks;
}

// Pull the portion of a clip's waveform between two fractions so a split clip
// keeps a representative shape for each new half without re-analysing audio.
export function slice_waveform(waveform = [], start_fraction = 0, end_fraction = 1) {
  if (!Array.isArray(waveform) || waveform.length === 0) {
    return [];
  }

  const start = Math.min(Math.max(start_fraction, 0), 1);
  const end = Math.min(Math.max(end_fraction, start), 1);
  const start_index = Math.floor(start * waveform.length);
  const end_index = Math.max(start_index + 1, Math.ceil(end * waveform.length));

  return waveform.slice(start_index, end_index).map(clamp_unit);
}
