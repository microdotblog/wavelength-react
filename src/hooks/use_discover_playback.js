import React from 'react';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

import { safe_audio_player_call } from '../lib/safe_audio_player';

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

export function use_discover_playback({
  audio_url = '',
  duration_seconds = 0,
  should_play = false,
} = {}) {
  const trimmed_audio_url = `${audio_url || ''}`.trim();
  const [wants_playback, set_wants_playback] = React.useState(false);
  const auto_play_url_ref = React.useRef('');
  const pending_play_ref = React.useRef(false);

  const player = useAudioPlayer(
    trimmed_audio_url ? { uri: trimmed_audio_url } : null,
    { updateInterval: STATUS_INTERVAL_MS },
  );
  const status = useAudioPlayerStatus(player);

  React.useEffect(() => {
    auto_play_url_ref.current = '';
    set_wants_playback(false);
    pending_play_ref.current = false;
  }, [trimmed_audio_url]);

  React.useEffect(() => {
    if (!should_play || !trimmed_audio_url) {
      auto_play_url_ref.current = '';
      set_wants_playback(false);
      pending_play_ref.current = false;
      safe_audio_player_call(status.isLoaded, () => player.pause());
      return;
    }

    if (auto_play_url_ref.current === trimmed_audio_url) {
      return;
    }

    auto_play_url_ref.current = trimmed_audio_url;
    set_wants_playback(true);
    pending_play_ref.current = true;
  }, [player, should_play, trimmed_audio_url, status.isLoaded]);

  React.useEffect(() => {
    if (!should_play || !wants_playback || !status.isLoaded || status.playing) {
      return;
    }

    safe_audio_player_call(status.isLoaded, () => player.play());
    pending_play_ref.current = false;
  }, [player, should_play, status.isLoaded, status.playing, wants_playback]);

  React.useEffect(() => {
    if (!status.didJustFinish) {
      return;
    }

    set_wants_playback(false);
    pending_play_ref.current = false;
  }, [status.didJustFinish]);

  const resolved_duration = status.duration > 0
    ? status.duration
    : Math.max(duration_seconds, 0);
  const current_time = clamp(status.currentTime || 0, 0, resolved_duration || status.currentTime || 0);
  const is_buffering = wants_playback && (!status.isLoaded || status.isBuffering);

  function play() {
    if (!trimmed_audio_url || !should_play) {
      return;
    }

    set_wants_playback(true);
    pending_play_ref.current = true;

    if (status.isLoaded) {
      safe_audio_player_call(status.isLoaded, () => player.play());
      pending_play_ref.current = false;
    }
  }

  function pause() {
    set_wants_playback(false);
    pending_play_ref.current = false;
    safe_audio_player_call(status.isLoaded, () => player.pause());
  }

  function seek(target_seconds = 0) {
    if (resolved_duration <= 0) {
      return;
    }

    const next_time = clamp(target_seconds, 0, resolved_duration);
    safe_audio_player_call(status.isLoaded, () => player.seekTo(next_time));
  }

  return {
    current_time,
    duration_seconds: resolved_duration,
    is_buffering,
    is_loaded: status.isLoaded,
    pause,
    play,
    playing: wants_playback && (status.playing || is_buffering),
    seek,
  };
}