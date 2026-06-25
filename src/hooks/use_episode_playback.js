import React from 'react';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

const STATUS_INTERVAL_MS = 100;
const CLIP_READY_TOLERANCE_SECONDS = 0.35;

function clamp(value, min, max) {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
}

function build_timeline(clips) {
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

function index_for_time(offsets, durations, target_seconds) {
  for (let index = offsets.length - 1; index >= 0; index -= 1) {
    if (target_seconds >= offsets[index]) {
      return index;
    }
  }

  return 0;
}

// Play an episode's clips back-to-back through a single player, swapping the
// source as each clip ends, while exposing one global timeline to the UI.
export function use_episode_playback(clips = []) {
  const safe_clips = Array.isArray(clips) ? clips : [];
  const uris_key = safe_clips.map(clip => clip.uri).join('|');
  const durations_key = safe_clips.map(clip => clip.duration_seconds).join('|');

  const [current_index, set_current_index] = React.useState(0);
  const [is_active, set_is_active] = React.useState(false);
  const [clip_ready, set_clip_ready] = React.useState(false);
  const pending_seek_ref = React.useRef(null);
  const awaiting_clip_sync_ref = React.useRef(false);
  const seek_issued_ref = React.useRef(false);

  const current_clip = safe_clips[current_index] || null;
  const player = useAudioPlayer(current_clip ? { uri: current_clip.uri } : null, {
    updateInterval: STATUS_INTERVAL_MS,
  });
  const status = useAudioPlayerStatus(player);

  const timeline = React.useMemo(
    () => build_timeline(safe_clips),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [uris_key, durations_key],
  );

  React.useEffect(() => {
    set_current_index(0);
    set_is_active(false);
    set_clip_ready(false);
    awaiting_clip_sync_ref.current = false;
    seek_issued_ref.current = false;
    pending_seek_ref.current = null;
  }, [uris_key]);

  // Apply a queued cross-clip seek once the new source is ready, then resume
  // playback if the listener was mid-playback when they scrubbed. Only mark the
  // clip ready once player time matches the intended local position — stale
  // end-of-clip time from the previous source would otherwise jump the scrubber.
  React.useEffect(() => {
    if (!status.isLoaded) {
      return;
    }

    const seek_target = pending_seek_ref.current ?? 0;

    if (pending_seek_ref.current != null && !seek_issued_ref.current) {
      player.seekTo(seek_target);
      seek_issued_ref.current = true;
    }

    if (awaiting_clip_sync_ref.current) {
      if (Math.abs((status.currentTime || 0) - seek_target) > CLIP_READY_TOLERANCE_SECONDS) {
        return;
      }

      awaiting_clip_sync_ref.current = false;
      seek_issued_ref.current = false;
      pending_seek_ref.current = null;
    }

    set_clip_ready(true);

    if (is_active && !status.playing) {
      player.play();
    }
  }, [current_index, is_active, player, status.currentTime, status.isLoaded, status.playing]);

  React.useEffect(() => {
    if (!status.didJustFinish) {
      return;
    }

    if (current_index < safe_clips.length - 1) {
      pending_seek_ref.current = 0;
      awaiting_clip_sync_ref.current = true;
      seek_issued_ref.current = false;
      set_clip_ready(false);
      set_current_index(current_index + 1);
    } else {
      set_is_active(false);
    }
  }, [current_index, safe_clips.length, status.didJustFinish]);

  function play() {
    if (safe_clips.length === 0) {
      return;
    }

    const at_end = current_index >= safe_clips.length - 1
      && status.duration > 0
      && status.currentTime >= status.duration;

    set_is_active(true);

    if (at_end) {
      pending_seek_ref.current = 0;
      awaiting_clip_sync_ref.current = true;
      seek_issued_ref.current = false;
      set_clip_ready(false);
      set_current_index(0);
      return;
    }

    player.play();
  }

  function pause() {
    set_is_active(false);
    player.pause();
  }

  function seek(global_seconds) {
    if (timeline.total_duration <= 0) {
      return;
    }

    const target = clamp(global_seconds, 0, timeline.total_duration);
    const target_index = index_for_time(timeline.offsets, timeline.durations, target);
    const local_time = target - timeline.offsets[target_index];

    if (target_index === current_index) {
      player.seekTo(local_time);
      return;
    }

    pending_seek_ref.current = local_time;
    awaiting_clip_sync_ref.current = true;
    seek_issued_ref.current = false;
    set_clip_ready(false);
    set_current_index(target_index);
  }

  const clip_offset = timeline.offsets[current_index] || 0;
  const clip_duration = timeline.durations[current_index] || status.duration || 0;
  const local_time = clip_ready
    ? clamp(status.currentTime || 0, 0, clip_duration || status.currentTime || 0)
    : clamp(pending_seek_ref.current ?? 0, 0, clip_duration || 0);
  const current_time = clamp(clip_offset + local_time, 0, timeline.total_duration);

  return {
    current_clip_index: current_index,
    current_time,
    is_transitioning: is_active && !clip_ready,
    pause,
    play,
    playing: is_active || status.playing,
    seek,
    total_duration: timeline.total_duration,
  };
}
