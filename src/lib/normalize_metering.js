const SILENCE_FLOOR_DB = -60;
const PEAK_CEILING_DB = 0;

export function normalize_metering(metering_db) {
  if (!Number.isFinite(metering_db)) {
    return 0;
  }

  const clamped_db = Math.min(Math.max(metering_db, SILENCE_FLOOR_DB), PEAK_CEILING_DB);

  return (clamped_db - SILENCE_FLOOR_DB) / (PEAK_CEILING_DB - SILENCE_FLOOR_DB);
}
