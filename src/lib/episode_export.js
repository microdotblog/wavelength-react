import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const AUDIO_MIME_TYPE = 'audio/mp4';
const AUDIO_UTI = 'public.mpeg-4-audio';
const FALLBACK_STEM = 'Episode';
const ILLEGAL_FILENAME_PATTERN = /[/\\:*?"<>|\x00]/g;
const MAX_FILENAME_STEM = 80;

function collapse_whitespace(value = '') {
  return `${value}`.replace(/\s+/g, ' ').trim();
}

export function sanitize_export_filename(title = '') {
  let stem = collapse_whitespace(title).replace(ILLEGAL_FILENAME_PATTERN, '');
  stem = collapse_whitespace(stem).replace(/^[.\s]+|[.\s]+$/g, '');

  if (stem.length > MAX_FILENAME_STEM) {
    stem = stem.slice(0, MAX_FILENAME_STEM).replace(/[.\s]+$/g, '');
  }

  if (!stem) {
    stem = FALLBACK_STEM;
  }

  return `${stem}.m4a`;
}

export async function prepare_episode_share_file(source_uri = '', title = '') {
  const trimmed_uri = `${source_uri || ''}`.trim();
  const trimmed_title = collapse_whitespace(title);

  if (!trimmed_uri) {
    throw new Error('Could not prepare audio.');
  }

  const source = new File(trimmed_uri);

  if (!source.exists) {
    throw new Error('Could not prepare audio.');
  }

  const destination = new File(Paths.cache, sanitize_export_filename(trimmed_title));

  await source.copy(destination, { overwrite: true });

  return {
    UTI: AUDIO_UTI,
    dialogTitle: trimmed_title || FALLBACK_STEM,
    mimeType: AUDIO_MIME_TYPE,
    uri: destination.uri,
  };
}

export async function share_episode_audio(source_uri = '', title = '') {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }

  const payload = await prepare_episode_share_file(source_uri, title);

  await Sharing.shareAsync(payload.uri, {
    UTI: payload.UTI,
    dialogTitle: payload.dialogTitle,
    mimeType: payload.mimeType,
  });
}
