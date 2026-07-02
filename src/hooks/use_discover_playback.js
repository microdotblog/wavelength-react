import React from 'react';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

import { build_discover_lock_screen_metadata } from '../lib/lock_screen_metadata';
import {
  disable_playback_audio_mode,
  enable_playback_audio_mode,
} from '../lib/playback_audio_mode';
import { safe_audio_player_call } from '../lib/safe_audio_player';
import { safe_player_side_effect } from '../lib/safe_player_side_effect';

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

function lock_screen_metadata_key(metadata = {}) {
  return [
    metadata.title,
    metadata.artist_name,
    metadata.artwork_url,
  ].join('\u0000');
}

export function use_discover_playback({
  artist_name = '',
  artwork_url = '',
  audio_url = '',
  duration_seconds = 0,
  should_play = false,
  title = '',
} = {}) {
  const trimmed_audio_url = `${audio_url || ''}`.trim();
  const [wants_playback, set_wants_playback] = React.useState(false);
  const auto_play_url_ref = React.useRef('');
  const pending_play_ref = React.useRef(false);
  const lock_screen_active_ref = React.useRef(false);
  const metadata_key = lock_screen_metadata_key({
    artist_name,
    artwork_url,
    title,
  });

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
    if (!should_play || !status.isLoaded) {
      return;
    }

    if (status.playing) {
      set_wants_playback(true);
      pending_play_ref.current = false;
      return;
    }

    if (!status.isBuffering && !pending_play_ref.current) {
      set_wants_playback(false);
    }
  }, [should_play, status.isBuffering, status.isLoaded, status.playing]);

  React.useEffect(() => {
    if (!status.didJustFinish) {
      return;
    }

    set_wants_playback(false);
    pending_play_ref.current = false;
  }, [status.didJustFinish]);

  React.useEffect(() => {
    let is_cancelled = false;

    async function sync_lock_screen_playback() {
      if (!should_play || !trimmed_audio_url) {
        if (lock_screen_active_ref.current) {
          safe_player_side_effect(player, () => player.clearLockScreenControls());
          lock_screen_active_ref.current = false;
        }

        await disable_playback_audio_mode();
        return;
      }

      await enable_playback_audio_mode();

      if (is_cancelled) {
        return;
      }

      const metadata = build_discover_lock_screen_metadata({
        artist_name,
        artwork_url,
        title,
      });

      if (lock_screen_active_ref.current) {
        safe_player_side_effect(player, () => {
          player.updateLockScreenMetadata(metadata);
        });
        return;
      }

      safe_player_side_effect(player, () => {
        player.setActiveForLockScreen(true, metadata);
      });
      lock_screen_active_ref.current = true;
    }

    sync_lock_screen_playback().catch(() => {});

    return () => {
      is_cancelled = true;

      if (lock_screen_active_ref.current) {
        safe_player_side_effect(player, () => player.clearLockScreenControls());
        lock_screen_active_ref.current = false;
      }

      disable_playback_audio_mode().catch(() => {});
    };
  }, [artist_name, artwork_url, metadata_key, player, should_play, title, trimmed_audio_url]);

  const resolved_duration = status.duration > 0
    ? status.duration
    : Math.max(duration_seconds, 0);
  const current_time = clamp(status.currentTime || 0, 0, resolved_duration || status.currentTime || 0);
  const is_buffering = should_play && wants_playback && (!status.isLoaded || status.isBuffering);

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
    playing: should_play && (status.playing || is_buffering),
    seek,
  };
}