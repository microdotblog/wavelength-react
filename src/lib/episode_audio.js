import { File } from 'expo-file-system';
import { concatAudioFiles } from 'react-native-audio-api';
import { extractPreviewBars, trimAudio } from '@siteed/audio-studio';

import WavelengthMP3Module from '../../modules/wavelength-mp3/src/WavelengthMP3Module';
import { get_episode_clip_uri, get_exported_clip_uri } from './EpisodeStorage';
import { WAVEFORM_SAMPLE_COUNT } from './downsample_waveform';

const IMPORT_ANALYSIS_END_MILLIS = 2_147_483_647;
const CANONICAL_AAC_OUTPUT_FORMAT = {
  bitrate: 128000,
  channels: 2,
  format: 'aac',
  sampleRate: 44100,
};

function build_m4a_uri(file_uri = '') {
  const trimmed_uri = `${file_uri || ''}`.trim();
  const last_slash_index = trimmed_uri.lastIndexOf('/');
  const extension_index = trimmed_uri.lastIndexOf('.');

  if (extension_index > last_slash_index) {
    return `${trimmed_uri.slice(0, extension_index)}.m4a`;
  }

  return `${trimmed_uri}.m4a`;
}

function to_seconds(duration_millis) {
  return Number.isFinite(duration_millis) ? Math.max(duration_millis / 1000, 0) : 0;
}

export function delete_audio_file(file_uri = '') {
  const trimmed_uri = `${file_uri || ''}`.trim();

  if (!trimmed_uri) {
    return;
  }

  const file = new File(trimmed_uri);

  if (file.exists) {
    file.delete();
  }
}

async function convert_audio_to_m4a(source_uri = '') {
  const trimmed_uri = `${source_uri || ''}`.trim();

  if (!trimmed_uri) {
    throw new Error('An audio file is required to create an M4A.');
  }

  if (trimmed_uri.toLowerCase().endsWith('.m4a')) {
    return trimmed_uri;
  }

  const output_uri = build_m4a_uri(trimmed_uri);
  delete_audio_file(output_uri);

  try {
    const converted_uri = `${await WavelengthMP3Module.exportM4aAsync(
      trimmed_uri,
      output_uri,
    ) || ''}`.trim();

    if (!converted_uri) {
      throw new Error('The audio file could not be converted to M4A.');
    }

    delete_audio_file(trimmed_uri);

    return converted_uri;
  } catch (error) {
    delete_audio_file(output_uri);
    throw error;
  }
}

// Decode the selected file once to find its complete duration and waveform,
// then transcode it to the same AAC-in-M4A settings used by new recordings.
export async function normalize_imported_audio(source_uri = '') {
  const trimmed_uri = `${source_uri || ''}`.trim();

  if (!trimmed_uri) {
    throw new Error('An audio file is required to add a segment.');
  }

  const preview = await extractPreviewBars({
    endTimeMs: IMPORT_ANALYSIS_END_MILLIS,
    fileUri: trimmed_uri,
    numberOfBars: WAVEFORM_SAMPLE_COUNT,
    startTimeMs: 0,
  });
  const duration_millis = Number.isFinite(preview?.durationMs)
    ? Math.max(preview.durationMs, 0)
    : 0;

  if (duration_millis <= 0) {
    throw new Error('That file does not contain any audio.');
  }

  const normalized = await trimAudio({
    endTimeMs: duration_millis,
    fileUri: trimmed_uri,
    mode: 'single',
    outputFileName: `import-${Date.now()}`,
    outputFormat: CANONICAL_AAC_OUTPUT_FORMAT,
    startTimeMs: 0,
  });
  const normalized_uri = `${normalized?.uri || ''}`.trim();
  const normalized_duration = Number.isFinite(normalized?.durationMs)
    ? Math.max(normalized.durationMs, 0)
    : duration_millis;

  if (!normalized_uri || normalized_duration <= 0) {
    delete_audio_file(normalized_uri);
    throw new Error('That audio file could not be converted.');
  }

  try {
    const m4a_uri = await convert_audio_to_m4a(normalized_uri);

    return {
      duration_seconds: to_seconds(normalized_duration),
      uri: m4a_uri,
      waveform: Array.isArray(preview?.bars)
        ? preview.bars.map(bar => bar?.amplitude).filter(Number.isFinite)
        : [],
    };
  } catch (error) {
    delete_audio_file(normalized_uri);
    throw error;
  }
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

// Publishing keeps the editable AAC source intact and performs one final
// decode/encode pass to a 128 kbps mono MP3.
export async function export_episode_mp3(source_uri = '') {
  const trimmed_uri = `${source_uri || ''}`.trim();

  if (!trimmed_uri) {
    throw new Error('An exported episode is required to create an MP3.');
  }

  const output_uri = trimmed_uri.toLowerCase().endsWith('.m4a')
    ? `${trimmed_uri.slice(0, -4)}.mp3`
    : `${trimmed_uri}.mp3`;
  const exported_uri = await WavelengthMP3Module.exportMp3Async(trimmed_uri, output_uri);

  if (!exported_uri) {
    throw new Error('The episode audio could not be encoded as MP3.');
  }

  return exported_uri;
}

// Cut one clip into two canonical AAC-in-M4A files. The caller moves the
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

  let first = null;
  let second = null;
  let first_uri = '';
  let second_uri = '';

  try {
    first = await trimAudio({
      endTimeMs: split_millis,
      fileUri: trimmed_uri,
      mode: 'single',
      outputFileName: `split-${stamp}-1`,
      outputFormat: CANONICAL_AAC_OUTPUT_FORMAT,
      startTimeMs: 0,
    });

    second = await trimAudio({
      endTimeMs: duration_millis,
      fileUri: trimmed_uri,
      mode: 'single',
      outputFileName: `split-${stamp}-2`,
      outputFormat: CANONICAL_AAC_OUTPUT_FORMAT,
      startTimeMs: split_millis,
    });

    first_uri = await convert_audio_to_m4a(first.uri);
    second_uri = await convert_audio_to_m4a(second.uri);

    return {
      first_seconds: to_seconds(first.durationMs),
      first_uri,
      second_seconds: to_seconds(second.durationMs),
      second_uri,
    };
  } catch (error) {
    delete_audio_file(first_uri || first?.uri);
    delete_audio_file(second_uri || second?.uri);
    throw error;
  }
}
