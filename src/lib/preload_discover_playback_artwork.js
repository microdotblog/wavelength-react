import { File } from 'expo-file-system';
import { widgetsDirectory } from 'expo-widgets';
import { Platform } from 'react-native';

function artwork_url_token(artwork_url = '') {
  let hash = 0;

  for (let index = 0; index < artwork_url.length; index += 1) {
    hash = (hash * 31 + artwork_url.charCodeAt(index)) >>> 0;
  }

  return hash.toString(16);
}

function safe_artwork_filename(post_id = '', artwork_url = '') {
  const safe_id = `${post_id || 'current'}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `discover-artwork-${safe_id}-${artwork_url_token(artwork_url)}`;
}

/**
 * Downloads Discover artwork into the shared widgets container so Live Activities
 * can render it via Image `uiImage`. Returns a local file:// URI, or '' on failure.
 */
export async function preload_discover_playback_artwork({
  artwork_url = '',
  post_id = '',
} = {}) {
  if (Platform.OS !== 'ios') {
    return '';
  }

  const trimmed_url = `${artwork_url || ''}`.trim();
  const shared_directory = `${widgetsDirectory || ''}`.trim();

  if (!trimmed_url || !shared_directory) {
    return '';
  }

  const destination = new File(
    shared_directory,
    safe_artwork_filename(post_id, trimmed_url),
  );

  try {
    if (destination.exists) {
      return destination.uri;
    }

    const downloaded = await File.downloadFileAsync(trimmed_url, destination, {
      idempotent: true,
    });

    return downloaded?.uri || '';
  } catch (error) {
    return '';
  }
}
