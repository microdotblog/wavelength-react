import { File } from 'expo-file-system';
import { concatAudioFiles } from 'react-native-audio-api';
import { trimAudio } from '@siteed/audio-studio';

import { get_episode_clip_uri, get_exported_clip_uri } from './EpisodeStorage';

const SPLIT_OUTPUT_FORMAT = { format: 'aac' };

function to_seconds(duration_millis) {
  return Number.isFinite(duration_millis) ? Math.max(duration_millis / 1000, 0) : 0;
}

// Stitch every clip into a single AAC file the publish flow can upload. Concat
// remuxes same-format segments without re-encoding, so it stays lossless.
export async function merge_episode_clips(episode = null) {
  const clips = Array.isArray(episode?.clips) ? episode.clips : [];

  if (clips.length === 0) {
    throw new Error('This episode has no clips to merge.');
  }

  const exported_uri = get_exported_clip_uri(episode);
  const exported_file = new File(exported_uri);

  if (exported_file.exists) {
    exported_file.delete();
  }

  const input_uris = clips.map(clip_name => get_episode_clip_uri(episode, clip_name));

  return concatAudioFiles(input_uris, exported_uri);
}

// Cut one clip into two AAC files at the chosen point. The caller moves the
// results into the episode folder and rewrites the clip order.
export async function split_clip_at(source_uri = '', split_seconds = 0, duration_seconds = 0) {
  const trimmed_uri = `${source_uri || ''}`.trim();

  if (!trimmed_uri) {
    throw new Error('A source clip is required to split.');
  }

  const split_millis = Math.round(Math.max(split_seconds, 0) * 1000);
  const duration_millis = Math.round(Math.max(duration_seconds, 0) * 1000);
  const stamp = Date.now();

  if (duration_millis <= split_millis) {
    throw new Error('Split point must be before the end of the clip.');
  }

  const first = await trimAudio({
    endTimeMs: split_millis,
    fileUri: trimmed_uri,
    mode: 'single',
    outputFileName: `split-${stamp}-1`,
    outputFormat: SPLIT_OUTPUT_FORMAT,
    startTimeMs: 0,
  });

  const second = await trimAudio({
    endTimeMs: duration_millis,
    fileUri: trimmed_uri,
    mode: 'single',
    outputFileName: `split-${stamp}-2`,
    outputFormat: SPLIT_OUTPUT_FORMAT,
    startTimeMs: split_millis,
  });

  return {
    first_seconds: to_seconds(first.durationMs),
    first_uri: first.uri,
    second_seconds: to_seconds(second.durationMs),
    second_uri: second.uri,
  };
}
