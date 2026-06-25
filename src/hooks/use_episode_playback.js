import React from 'react';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

const STATUS_INTERVAL_MS = 100;

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
  const pending_seek_ref = React.useRef(null);
  const handled_finish_ref = React.useRef(false);

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
    handled_finish_ref.current = false;
    pending_seek_ref.current = null;
  }, [uris_key]);

  // Apply a queued cross-clip seek once the new source is ready, then resume
  // playback if the listener was mid-playback when they scrubbed.
  React.useEffect(() => {
    if (!status.isLoaded) {
      return;
    }

    if (pending_seek_ref.current != null) {
      player.seekTo(pending_seek_ref.current);
      pending_seek_ref.current = null;
    }

    if (is_active && !status.playing) {
      player.play();
    }
  }, [current_index, is_active, player, status.isLoaded, status.playing]);

  React.useEffect(() => {
    if (!status.didJustFinish) {
      handled_finish_ref.current = false;
      return;
    }

    if (handled_finish_ref.current) {
      return;
    }

    handled_finish_ref.current = true;

    if (current_index < safe_clips.length - 1) {
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
    set_current_index(target_index);
  }

  const clip_offset = timeline.offsets[current_index] || 0;
  const clip_duration = timeline.durations[current_index] || status.duration || 0;
  const local_time = clamp(status.currentTime || 0, 0, clip_duration || status.currentTime || 0);
  const current_time = clamp(clip_offset + local_time, 0, timeline.total_duration);

  return {
    current_clip_index: current_index,
    current_time,
    pause,
    play,
    playing: is_active || status.playing,
    seek,
    total_duration: timeline.total_duration,
  };
}