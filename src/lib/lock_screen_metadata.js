export const DISCOVER_ALBUM_TITLE = 'Discover';

export function build_discover_lock_screen_metadata({
  artist_name = '',
  artwork_url = '',
  title = '',
} = {}) {
  const metadata = {
    albumTitle: DISCOVER_ALBUM_TITLE,
    artist: `${artist_name || ''}`.trim() || 'Micro.blog',
    title: `${title || ''}`.trim() || 'Discover microcast',
  };
  const trimmed_artwork_url = `${artwork_url || ''}`.trim();

  if (trimmed_artwork_url) {
    metadata.artworkUrl = trimmed_artwork_url;
  }

  return metadata;
}