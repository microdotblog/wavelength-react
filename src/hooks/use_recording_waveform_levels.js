import { useEffect, useRef, useState } from 'react';

import { normalize_metering } from '../lib/normalize_metering';

export const BAR_COUNT = 28;
const IDLE_LEVEL = 0.08;
const TICK_MS = 60;
const SAMPLE_SMOOTHING = 0.4;
const IDLE_DECAY = 0.18;
const SETTLED_THRESHOLD = 0.01;

function create_idle_levels() {
  return new Array(BAR_COUNT).fill(IDLE_LEVEL);
}

function lerp(from, to, amount) {
  return from + (to - from) * amount;
}

// Used only when a platform does not report metering, so the bars still feel alive.
function fallback_pulse(duration_millis) {
  const phase = (duration_millis / 120) % (Math.PI * 2);

  return 0.3 + 0.2 * Math.abs(Math.sin(phase));
}

export function use_recording_waveform_levels({ duration_millis, is_recording, metering }) {
  const [levels, set_levels] = useState(create_idle_levels);
  const inputs_ref = useRef({ duration_millis, is_recording, metering });
  const smoothed_level_ref = useRef(IDLE_LEVEL);

  inputs_ref.current = { duration_millis, is_recording, metering };

  useEffect(() => {
    const interval = setInterval(() => {
      const current_inputs = inputs_ref.current;

      if (current_inputs.is_recording) {
        const raw_level = Number.isFinite(current_inputs.metering)
          ? normalize_metering(current_inputs.metering)
          : fallback_pulse(current_inputs.duration_millis);

        smoothed_level_ref.current = lerp(smoothed_level_ref.current, raw_level, SAMPLE_SMOOTHING);
        const next_level = smoothed_level_ref.current;
        set_levels(previous_levels => [...previous_levels.slice(1), next_level]);
      } else {
        smoothed_level_ref.current = IDLE_LEVEL;
        set_levels(previous_levels => {
          const needs_decay = previous_levels.some(
            level => Math.abs(level - IDLE_LEVEL) > SETTLED_THRESHOLD,
          );

          if (!needs_decay) {
            return previous_levels;
          }

          return previous_levels.map(level => lerp(level, IDLE_LEVEL, IDLE_DECAY));
        });
      }
    }, TICK_MS);

    return () => clearInterval(interval);
  }, []);

  return levels;
}
