import { Directory, File, Paths } from 'expo-file-system';

import { WAVEFORM_SAMPLE_COUNT } from './downsample_waveform';
import { sanitize_size_bytes } from './episode_upload_size';
import { merge_episode_waveform } from './merge_episode_waveform';

const NARRATIONS_DIR_NAME = 'narrations';
const DRAFT_INFO_FILENAME = 'draft.json';
const SEGMENT_BASENAME = 'segment';
const DEFAULT_SEGMENT_EXTENSION = '.m4a';
const SEGMENT_INDEX_PATTERN = /^segment(?:-(\d+))?\./i;

function get_narrations_directory() {
  const directory = new Directory(Paths.document, NARRATIONS_DIR_NAME);

  if (!directory.exists) {
    directory.create({ idempotent: true, intermediates: true });
  }

  return directory;
}

export function narration_draft_id(post_uid = '') {
  return `${post_uid || ''}`
    .trim()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function normalize_folder_uri(uri = '') {
  if (uri.endsWith('/')) {
    return uri;
  }

  return `${uri}/`;
}

function sanitize_waveform(waveform) {
  if (!Array.isArray(waveform)) {
    return [];
  }

  return waveform
    .filter(Number.isFinite)
    .map(value => Math.min(Math.max(value, 0), 1));
}

function sanitize_duration(value) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function normalize_clip_meta(clip) {
  return {
    duration_seconds: sanitize_duration(clip?.duration_seconds),
    name: `${clip?.name || ''}`,
    size_bytes: sanitize_size_bytes(clip?.size_bytes),
    waveform: sanitize_waveform(clip?.waveform),
  };
}

function read_clip_size_bytes(directory, clip_name = '') {
  const trimmed_name = `${clip_name || ''}`.trim();

  if (!directory || !trimmed_name) {
    return 0;
  }

  const clip_file = new File(directory, trimmed_name);

  if (!clip_file.exists) {
    return 0;
  }

  return sanitize_size_bytes(clip_file.size);
}

function hydrate_clip_meta(directory, clip_meta = []) {
  return clip_meta.map(clip => {
    const normalized = normalize_clip_meta(clip);

    if (normalized.size_bytes > 0) {
      return normalized;
    }

    return {
      ...normalized,
      size_bytes: read_clip_size_bytes(directory, normalized.name),
    };
  });
}

function compose_draft_info({ clip_meta, created_at }) {
  const safe_meta = clip_meta.map(normalize_clip_meta).filter(clip => clip.name.length > 0);

  return {
    clip_meta: safe_meta,
    clips: safe_meta.map(clip => clip.name),
    created_at,
    duration_seconds: safe_meta.reduce((sum, clip) => sum + clip.duration_seconds, 0),
    waveform: merge_episode_waveform(safe_meta, WAVEFORM_SAMPLE_COUNT),
  };
}

function build_segment_name(index, extension) {
  return `${SEGMENT_BASENAME}-${index}${extension || DEFAULT_SEGMENT_EXTENSION}`;
}

function next_segment_index(directory) {
  let highest = 0;

  for (const entry of directory.list()) {
    if (!(entry instanceof File)) {
      continue;
    }

    const match = entry.name.match(SEGMENT_INDEX_PATTERN);

    if (!match) {
      continue;
    }

    const parsed_index = match[1] ? Number.parseInt(match[1], 10) : 1;
    highest = Math.max(highest, parsed_index);
  }

  return highest + 1;
}

function write_draft_info(directory, info) {
  const info_file = new File(directory, DRAFT_INFO_FILENAME);
  info_file.write(JSON.stringify(info, null, 2));
}

function to_draft_snapshot(info, directory, post_uid) {
  return {
    ...info,
    folder_uri: normalize_folder_uri(directory.uri),
    post_uid,
  };
}

function get_narration_directory(post_uid = '') {
  const id = narration_draft_id(post_uid);

  if (!id) {
    return null;
  }

  const directory = new Directory(get_narrations_directory(), id);

  if (!directory.exists) {
    return null;
  }

  return directory;
}

function create_narration_directory(post_uid) {
  const id = narration_draft_id(post_uid);

  if (!id) {
    throw new Error('A post is required to edit narration.');
  }

  const parent = get_narrations_directory();
  const directory = new Directory(parent, id);

  if (directory.exists) {
    directory.delete();
  }

  directory.create({ intermediates: true });

  return directory;
}

function prune_orphan_clips(directory, clips) {
  const kept = new Set(clips);

  for (const entry of directory.list()) {
    if (!(entry instanceof File) || !SEGMENT_INDEX_PATTERN.test(entry.name)) {
      continue;
    }

    if (!kept.has(entry.name)) {
      entry.delete();
    }
  }
}

function read_draft_from_directory(directory, post_uid) {
  const info_file = new File(directory, DRAFT_INFO_FILENAME);

  if (!info_file.exists) {
    return null;
  }

  try {
    const parsed = JSON.parse(info_file.textSync() || '{}');
    const clip_meta = hydrate_clip_meta(directory, parsed.clip_meta || []);
    const info = compose_draft_info({
      clip_meta,
      created_at: `${parsed.created_at || ''}`.trim() || new Date().toISOString(),
    });

    return to_draft_snapshot(info, directory, post_uid);
  } catch {
    return null;
  }
}

export async function copy_narration_take(source_uri = '') {
  const trimmed_uri = `${source_uri || ''}`.trim();

  if (!trimmed_uri) {
    throw new Error('A narration take is required.');
  }

  const source = new File(trimmed_uri);

  if (!source.exists) {
    throw new Error('That narration could not be prepared.');
  }

  const destination = new File(Paths.cache, `narration-take-${Date.now()}.m4a`);

  await source.copy(destination, { overwrite: true });
  const copied_uri = `${destination.uri || ''}`.trim();

  if (!copied_uri) {
    throw new Error('That narration could not be prepared.');
  }

  return copied_uri;
}

export async function download_remote_audio(url = '') {
  const trimmed_url = `${url || ''}`.trim();

  if (!trimmed_url) {
    throw new Error('A narration audio URL is required.');
  }

  if (!/^https?:/i.test(trimmed_url)) {
    return trimmed_url;
  }

  const destination = new File(Paths.cache, `narration-source-${Date.now()}.m4a`);
  const downloaded = await File.downloadFileAsync(trimmed_url, destination, { idempotent: true });
  const downloaded_uri = `${downloaded?.uri || destination.uri || ''}`.trim();

  if (!downloaded_uri) {
    throw new Error('That narration could not be downloaded.');
  }

  return downloaded_uri;
}

export function delete_narration_draft(post_uid = '') {
  const directory = get_narration_directory(post_uid);

  if (directory) {
    directory.delete();
  }
}

export async function create_narration_draft({
  duration_seconds = 0,
  post_uid = '',
  source_uri = '',
  waveform = [],
} = {}) {
  const trimmed_uid = `${post_uid || ''}`.trim();
  const trimmed_uri = `${source_uri || ''}`.trim();

  if (!narration_draft_id(trimmed_uid)) {
    throw new Error('A post is required to edit narration.');
  }

  if (!trimmed_uri) {
    throw new Error('A narration audio file is required.');
  }

  const directory = create_narration_directory(trimmed_uid);
  const source_file = new File(trimmed_uri);
  const extension = source_file.extension || DEFAULT_SEGMENT_EXTENSION;
  const segment_name = build_segment_name(1, extension);
  const segment_file = new File(directory, segment_name);

  await source_file.move(segment_file);

  const info = compose_draft_info({
    clip_meta: [
      {
        duration_seconds,
        name: segment_name,
        size_bytes: read_clip_size_bytes(directory, segment_name),
        waveform,
      },
    ],
    created_at: new Date().toISOString(),
  });

  write_draft_info(directory, info);

  return to_draft_snapshot(info, directory, trimmed_uid);
}

export async function place_narration_clip_file(post_uid = '', source_uri = '') {
  const directory = get_narration_directory(post_uid);
  const trimmed_uri = `${source_uri || ''}`.trim();

  if (!directory || !trimmed_uri) {
    throw new Error('A valid narration and source file are required to add a clip.');
  }

  const source_file = new File(trimmed_uri);
  const extension = source_file.extension || DEFAULT_SEGMENT_EXTENSION;
  const segment_name = build_segment_name(next_segment_index(directory), extension);

  await source_file.move(new File(directory, segment_name));

  return segment_name;
}

export async function append_clip_to_narration(
  post_uid = '',
  recording_uri = '',
  duration_seconds = 0,
  waveform = [],
) {
  const directory = get_narration_directory(post_uid);

  if (!directory) {
    throw new Error('That narration is no longer available.');
  }

  const existing = read_draft_from_directory(directory, post_uid);

  if (!existing) {
    throw new Error('That narration could not be read.');
  }

  let segment_name = '';

  try {
    segment_name = await place_narration_clip_file(post_uid, recording_uri);

    const info = compose_draft_info({
      clip_meta: [
        ...existing.clip_meta,
        {
          duration_seconds,
          name: segment_name,
          size_bytes: read_clip_size_bytes(directory, segment_name),
          waveform,
        },
      ],
      created_at: existing.created_at,
    });

    write_draft_info(directory, info);

    return to_draft_snapshot(info, directory, post_uid);
  } catch (error) {
    const segment_file = segment_name ? new File(directory, segment_name) : null;

    if (segment_file?.exists) {
      segment_file.delete();
    }

    throw error;
  }
}

export async function replace_narration_clips(post_uid = '', clip_meta = []) {
  const directory = get_narration_directory(post_uid);

  if (!directory) {
    throw new Error('That narration is no longer available.');
  }

  const hydrated = hydrate_clip_meta(directory, clip_meta).filter(clip => clip.name.length > 0);

  if (hydrated.length === 0) {
    throw new Error('Narration needs at least one segment.');
  }

  const existing = read_draft_from_directory(directory, post_uid);
  const info = compose_draft_info({
    clip_meta: hydrated,
    created_at: existing?.created_at || new Date().toISOString(),
  });

  write_draft_info(directory, info);
  prune_orphan_clips(directory, info.clips);

  return to_draft_snapshot(info, directory, post_uid);
}
