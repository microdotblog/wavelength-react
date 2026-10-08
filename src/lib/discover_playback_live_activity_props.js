export function build_discover_playback_live_activity_props({
  artist_name = '',
  artwork_uri = '',
  now_ms = Date.now(),
  remaining_ms = 0,
  title = '',
} = {}) {
  const safe_remaining = Number.isFinite(remaining_ms) ? Math.max(0, remaining_ms) : 0;
  const trimmed_title = `${title || ''}`.trim();
  const trimmed_artist = `${artist_name || ''}`.trim();
  const trimmed_artwork = `${artwork_uri || ''}`.trim();

  return {
    artistName: trimmed_artist || 'Discover',
    artworkUri: trimmed_artwork,
    endsAtMs: now_ms + safe_remaining,
    startsAtMs: now_ms,
    title: trimmed_title || 'Podcast',
  };
}
