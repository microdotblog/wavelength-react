import { Directory, File, Paths } from 'expo-file-system';

import { WAVEFORM_SAMPLE_COUNT } from './downsample_waveform';
import { sanitize_size_bytes } from './episode_upload_size';
import { merge_episode_waveform } from './merge_episode_waveform';

const EPISODES_DIR_NAME = 'episodes';
const EPISODE_INFO_FILENAME = 'episode.json';
const EXPORTED_FILENAME = 'exported.m4a';
const SEGMENT_BASENAME = 'segment';
const DEFAULT_SEGMENT_EXTENSION = '.m4a';
const SEGMENT_INDEX_PATTERN = /^segment(?:-(\d+))?\./i;

function get_episodes_directory() {
  const directory = new Directory(Paths.document, EPISODES_DIR_NAME);

  if (!directory.exists) {
    directory.create({ idempotent: true, intermediates: true });
  }

  return directory;
}

function build_episode_id(date) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function build_episode_title(date) {
  return date.toLocaleString(undefined, {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  });
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

// A single take always carries the whole episode shape, so the merged values
// collapse back to that take. Legacy episodes therefore stay identical.
function compose_episode_info({
  clip_meta,
  created_at,
  post_id = null,
  post_url = null,
  published_at = null,
  title,
}) {
  const safe_meta = clip_meta.map(normalize_clip_meta).filter(clip => clip.name.length > 0);
  const trimmed_post_id = `${post_id || ''}`.trim();
  const trimmed_post_url = `${post_url || ''}`.trim();
  const trimmed_published_at = `${published_at || ''}`.trim();

  return {
    clip_meta: safe_meta,
    clips: safe_meta.map(clip => clip.name),
    created_at,
    duration_seconds: safe_meta.reduce((sum, clip) => sum + clip.duration_seconds, 0),
    title,
    waveform: merge_episode_waveform(safe_meta, WAVEFORM_SAMPLE_COUNT),
    ...(trimmed_post_id ? { post_id: trimmed_post_id } : {}),
    ...(trimmed_post_url ? { post_url: trimmed_post_url } : {}),
    ...(trimmed_published_at ? { published_at: trimmed_published_at } : {}),
  };
}

function migrate_clip_meta(parsed, clips) {
  if (Array.isArray(parsed.clip_meta) && parsed.clip_meta.length === clips.length) {
    return parsed.clip_meta;
  }

  const top_level_duration = sanitize_duration(parsed.duration_seconds);
  const per_clip_duration = clips.length > 0 ? top_level_duration / clips.length : 0;
  const top_level_waveform = sanitize_waveform(parsed.waveform);

  return clips.map((name, index) => ({
    duration_seconds: per_clip_duration,
    name,
    waveform: index === 0 ? top_level_waveform : [],
  }));
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

function create_episode_directory(date) {
  const episodes_directory = get_episodes_directory();
  const base_id = build_episode_id(date);

  let candidate_id = base_id;
  let attempt = 1;
  let directory = new Directory(episodes_directory, candidate_id);

  while (directory.exists) {
    attempt += 1;
    candidate_id = `${base_id}-${attempt}`;
    directory = new Directory(episodes_directory, candidate_id);
  }

  directory.create({ intermediates: true });

  return {
    directory,
    id: candidate_id,
  };
}

function get_episode_directory(episode_id) {
  const trimmed_id = `${episode_id || ''}`.trim();

  if (!trimmed_id) {
    return null;
  }

  const directory = new Directory(get_episodes_directory(), trimmed_id);

  if (!directory.exists) {
    return null;
  }

  return directory;
}

function delete_exported_file(directory) {
  const exported_file = new File(directory, EXPORTED_FILENAME);

  if (exported_file.exists) {
    exported_file.delete();
  }
}

// Drop any segment files left on disk that the new clip order no longer
// references. This covers deletes and the original file replaced by a split.
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

function write_episode_info(directory, info) {
  const info_file = new File(directory, EPISODE_INFO_FILENAME);
  info_file.write(JSON.stringify(info, null, 2));
}

async function copy_segment_file(source_directory, directory, clip_name) {
  const source_file = new File(source_directory, clip_name);

  if (!source_file.exists) {
    throw new Error('This episode is missing one of its segments.');
  }

  const dest_file = new File(directory, clip_name);
  const bytes = await source_file.arrayBuffer();
  dest_file.write(new Uint8Array(bytes));
}

function to_episode_snapshot(info, directory, id) {
  return {
    ...info,
    folder_uri: normalize_folder_uri(directory.uri),
    id,
  };
}

function read_episode_from_directory(directory) {
  const info_file = new File(directory, EPISODE_INFO_FILENAME);

  if (!info_file.exists) {
    return null;
  }

  try {
    const parsed = JSON.parse(info_file.textSync());
    const clips = Array.isArray(parsed.clips) ? parsed.clips : [];

    if (clips.length === 0) {
      return null;
    }

    const clip_meta = hydrate_clip_meta(directory, migrate_clip_meta(parsed, clips));
    const info = compose_episode_info({
      clip_meta,
      created_at: `${parsed.created_at || ''}`,
      post_id: parsed.post_id,
      post_url: parsed.post_url,
      published_at: parsed.published_at,
      title: `${parsed.title || directory.name}`,
    });

    return to_episode_snapshot(info, directory, directory.name);
  } catch (error) {
    return null;
  }
}

export async function save_episode_from_recording(recording_uri = '', duration_seconds = 0, waveform = []) {
  const trimmed_uri = `${recording_uri || ''}`.trim();

  if (!trimmed_uri) {
    throw new Error('A recording URI is required to save an episode.');
  }

  const created_at = new Date();
  const { directory, id } = create_episode_directory(created_at);

  const source_file = new File(trimmed_uri);
  const extension = source_file.extension || DEFAULT_SEGMENT_EXTENSION;
  const segment_name = build_segment_name(1, extension);
  const segment_file = new File(directory, segment_name);

  await source_file.move(segment_file);

  const info = compose_episode_info({
    clip_meta: [
      {
        duration_seconds,
        name: segment_name,
        size_bytes: read_clip_size_bytes(directory, segment_name),
        waveform,
      },
    ],
    created_at: created_at.toISOString(),
    post_id: null,
    post_url: null,
    published_at: null,
    title: build_episode_title(created_at),
  });

  write_episode_info(directory, info);

  return to_episode_snapshot(info, directory, id);
}

// Move a freshly recorded or processed temp file into an episode folder under
// the next free segment name and return that name so callers can build meta.
export async function place_clip_file(episode_id = '', source_uri = '') {
  const directory = get_episode_directory(episode_id);
  const trimmed_uri = `${source_uri || ''}`.trim();

  if (!directory || !trimmed_uri) {
    throw new Error('A valid episode and source file are required to add a clip.');
  }

  const source_file = new File(trimmed_uri);
  const extension = source_file.extension || DEFAULT_SEGMENT_EXTENSION;
  const segment_name = build_segment_name(next_segment_index(directory), extension);

  await source_file.move(new File(directory, segment_name));

  return segment_name;
}

export async function append_clip_to_episode(episode_id = '', recording_uri = '', duration_seconds = 0, waveform = []) {
  const directory = get_episode_directory(episode_id);

  if (!directory) {
    throw new Error('That episode is no longer available.');
  }

  const existing = read_episode_from_directory(directory);

  if (!existing) {
    throw new Error('That episode could not be read.');
  }

  let segment_name = '';

  try {
    segment_name = await place_clip_file(episode_id, recording_uri);

    const clip_meta = [
      ...existing.clip_meta,
      {
        duration_seconds,
        name: segment_name,
        size_bytes: read_clip_size_bytes(directory, segment_name),
        waveform,
      },
    ];
    const info = compose_episode_info({
      clip_meta,
      created_at: existing.created_at,
      post_id: existing.post_id,
      post_url: existing.post_url,
      published_at: existing.published_at,
      title: existing.title,
    });

    delete_exported_file(directory);
    write_episode_info(directory, info);

    return to_episode_snapshot(info, directory, directory.name);
  } catch (error) {
    const segment_file = segment_name ? new File(directory, segment_name) : null;

    if (segment_file?.exists) {
      segment_file.delete();
    }

    throw error;
  }
}

export async function update_episode_title(episode_id = '', title = '') {
  const directory = get_episode_directory(episode_id);
  const trimmed_title = `${title || ''}`.trim();

  if (!directory) {
    throw new Error('That episode is no longer available.');
  }

  if (!trimmed_title) {
    throw new Error('Episode title cannot be empty.');
  }

  const existing = read_episode_from_directory(directory);

  if (!existing) {
    throw new Error('That episode could not be read.');
  }

  const info = compose_episode_info({
    clip_meta: existing.clip_meta,
    created_at: existing.created_at,
    post_id: existing.post_id,
    post_url: existing.post_url,
    published_at: existing.published_at,
    title: trimmed_title,
  });

  write_episode_info(directory, info);

  return to_episode_snapshot(info, directory, directory.name);
}

export async function replace_episode_clips(episode_id = '', clip_meta = []) {
  const directory = get_episode_directory(episode_id);

  if (!directory) {
    throw new Error('That episode is no longer available.');
  }

  const existing = read_episode_from_directory(directory);
  const info = compose_episode_info({
    clip_meta: hydrate_clip_meta(directory, clip_meta),
    created_at: existing ? existing.created_at : new Date().toISOString(),
    post_id: existing?.post_id,
    post_url: existing?.post_url,
    published_at: existing?.published_at,
    title: existing ? existing.title : directory.name,
  });

  delete_exported_file(directory);
  write_episode_info(directory, info);
  prune_orphan_clips(directory, info.clips);

  return to_episode_snapshot(info, directory, directory.name);
}

export async function mark_episode_published(
  episode_id = '',
  { post_id = '', post_url = '' } = {},
) {
  const directory = get_episode_directory(episode_id);
  const trimmed_post_id = `${post_id || ''}`.trim();
  const trimmed_post_url = `${post_url || ''}`.trim();

  if (!directory) {
    throw new Error('That episode is no longer available.');
  }

  if (!trimmed_post_id && !trimmed_post_url) {
    throw new Error('A published post id or URL is required.');
  }

  const existing = read_episode_from_directory(directory);

  if (!existing) {
    throw new Error('That episode could not be read.');
  }

  const info = compose_episode_info({
    clip_meta: existing.clip_meta,
    created_at: existing.created_at,
    post_id: trimmed_post_id || existing.post_id,
    post_url: trimmed_post_url || existing.post_url,
    published_at: new Date().toISOString(),
    title: existing.title,
  });

  write_episode_info(directory, info);

  return to_episode_snapshot(info, directory, directory.name);
}

export async function duplicate_episode(episode_id = '') {
  const source_directory = get_episode_directory(episode_id);

  if (!source_directory) {
    throw new Error('That episode is no longer available.');
  }

  const existing = read_episode_from_directory(source_directory);

  if (!existing) {
    throw new Error('That episode could not be read.');
  }

  const created_at = new Date();
  const { directory, id } = create_episode_directory(created_at);

  for (const clip_name of existing.clips) {
    await copy_segment_file(source_directory, directory, clip_name);
  }

  const info = compose_episode_info({
    clip_meta: existing.clip_meta.map(clip => ({
      duration_seconds: clip.duration_seconds,
      name: clip.name,
      size_bytes: clip.size_bytes,
      waveform: clip.waveform.slice(),
    })),
    created_at: created_at.toISOString(),
    title: `${existing.title} Copy`,
  });

  write_episode_info(directory, info);

  return to_episode_snapshot(info, directory, id);
}

export async function clear_episode_publish_link(episode_id = '') {
  const directory = get_episode_directory(episode_id);

  if (!directory) {
    throw new Error('That episode is no longer available.');
  }

  const existing = read_episode_from_directory(directory);

  if (!existing) {
    throw new Error('That episode could not be read.');
  }

  const info = compose_episode_info({
    clip_meta: existing.clip_meta,
    created_at: existing.created_at,
    title: existing.title,
  });

  write_episode_info(directory, info);

  return to_episode_snapshot(info, directory, directory.name);
}

export async function read_episode(episode_id = '') {
  const directory = get_episode_directory(episode_id);

  if (!directory) {
    return null;
  }

  return read_episode_from_directory(directory);
}

export async function list_episodes() {
  const episodes_directory = get_episodes_directory();
  const entries = episodes_directory.list();
  const episodes = [];

  for (const entry of entries) {
    if (entry instanceof Directory) {
      const episode = read_episode_from_directory(entry);

      if (episode) {
        episodes.push(episode);
      }
    }
  }

  return episodes;
}

export async function delete_episode(episode_id = '') {
  const directory = get_episode_directory(episode_id);

  if (directory) {
    directory.delete();
  }
}

export function get_episode_clip_uri(episode = null, clip_name = '') {
  if (!episode || !episode.folder_uri) {
    return '';
  }

  const target_clip = clip_name || episode.clips?.[0] || '';

  if (!target_clip) {
    return '';
  }

  return `${normalize_folder_uri(episode.folder_uri)}${target_clip}`;
}

export function get_exported_clip_uri(episode = null) {
  if (!episode || !episode.folder_uri) {
    return '';
  }

  return `${normalize_folder_uri(episode.folder_uri)}${EXPORTED_FILENAME}`;
}

export function read_file_size_bytes(file_uri = '') {
  const trimmed_uri = `${file_uri || ''}`.trim();

  if (!trimmed_uri) {
    return 0;
  }

  const file = new File(trimmed_uri);

  if (!file.exists) {
    return 0;
  }

  return sanitize_size_bytes(file.size);
}
