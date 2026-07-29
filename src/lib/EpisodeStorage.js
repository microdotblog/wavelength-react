import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { WAVEFORM_SAMPLE_COUNT } from './downsample_waveform';
import { sanitize_size_bytes } from './episode_upload_size';
import { merge_episode_waveform } from './merge_episode_waveform';

const EPISODES_DIR_NAME = 'episodes';
const EPISODE_INFO_FILENAME = 'episode.json';
const EXPORTED_FILENAME = 'exported.m4a';
const LEGACY_INFO_FILENAME = 'clips.plist';
const LEGACY_EPISODE_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:-\d+)?$/;
const LEGACY_EPISODE_PREFIX = 'legacy-';
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

function decode_legacy_folder_name(folder_name = '') {
  try {
    return decodeURIComponent(folder_name);
  } catch (error) {
    return folder_name;
  }
}

function is_legacy_episode_folder_name(folder_name = '') {
  return LEGACY_EPISODE_PATTERN.test(decode_legacy_folder_name(folder_name));
}

function decode_xml_text(value = '') {
  const named_entities = {
    amp: '&',
    apos: '\'',
    gt: '>',
    lt: '<',
    quot: '"',
  };

  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&(amp|apos|gt|lt|quot);/g, (_, name) => named_entities[name]);
}

export function parse_legacy_episode_plist(contents = '') {
  const title_match = contents.match(
    /<key>\s*title\s*<\/key>\s*<string>([\s\S]*?)<\/string>/i,
  );
  const clips_match = contents.match(
    /<key>\s*clips\s*<\/key>\s*<array>([\s\S]*?)<\/array>/i,
  );
  const clips = [];

  if (clips_match) {
    const clip_pattern = /<string>([\s\S]*?)<\/string>/gi;
    let clip_match = clip_pattern.exec(clips_match[1]);

    while (clip_match) {
      const clip_name = decode_xml_text(clip_match[1]).trim();
      const is_safe_name = clip_name.length > 0 &&
        clip_name !== '.' &&
        clip_name !== '..' &&
        !clip_name.includes('/') &&
        !clip_name.includes('\\');

      if (is_safe_name) {
        clips.push(clip_name);
      }

      clip_match = clip_pattern.exec(clips_match[1]);
    }
  }

  return {
    clips,
    title: title_match ? decode_xml_text(title_match[1]).trim() : '',
  };
}

function legacy_episode_created_at(directory) {
  if (Number.isFinite(directory.creationTime) && directory.creationTime > 0) {
    return new Date(directory.creationTime).toISOString();
  }

  const folder_name = decode_legacy_folder_name(directory.name);
  const match = folder_name.match(
    /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})(?:-\d+)?$/,
  );

  if (!match) {
    return new Date().toISOString();
  }

  const date = new Date(
    Number.parseInt(match[1], 10),
    Number.parseInt(match[2], 10) - 1,
    Number.parseInt(match[3], 10),
    Number.parseInt(match[4], 10),
    Number.parseInt(match[5], 10),
    Number.parseInt(match[6], 10),
  );

  return date.toISOString();
}

function build_legacy_episode_id(folder_name = '') {
  const safe_name = decode_legacy_folder_name(folder_name)
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

  return `${LEGACY_EPISODE_PREFIX}${safe_name}`;
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

function is_complete_episode(directory, episode) {
  if (!episode || episode.clip_meta.length === 0) {
    return false;
  }

  return episode.clip_meta.every(clip => {
    const clip_file = new File(directory, clip.name);

    return clip.duration_seconds > 0 && clip_file.exists && clip_file.size > 0;
  });
}

function read_legacy_episode_from_directory(directory) {
  const info_file = new File(directory, LEGACY_INFO_FILENAME);

  if (!info_file.exists) {
    return null;
  }

  try {
    const parsed = parse_legacy_episode_plist(info_file.textSync());
    const clips = [];

    for (const clip_name of parsed.clips) {
      const clip_file = new File(directory, clip_name);

      if (!clip_file.exists || clip_file.size <= 0) {
        return null;
      }

      clips.push({
        name: clip_name,
        uri: clip_file.uri,
      });
    }

    if (clips.length === 0) {
      return null;
    }

    return {
      clips,
      created_at: legacy_episode_created_at(directory),
      id: directory.name,
      title: parsed.title || decode_legacy_folder_name(directory.name),
    };
  } catch (error) {
    return null;
  }
}

export async function list_legacy_episodes() {
  if (Platform.OS !== 'ios') {
    return [];
  }

  const documents_directory = new Directory(Paths.document);
  const legacy_episodes = [];

  for (const entry of documents_directory.list()) {
    if (!(entry instanceof Directory) || !is_legacy_episode_folder_name(entry.name)) {
      continue;
    }

    const legacy_episode = read_legacy_episode_from_directory(entry);

    if (legacy_episode) {
      legacy_episodes.push(legacy_episode);
    }
  }

  return legacy_episodes;
}

export async function read_migrated_episode(
  legacy_episode_id = '',
  expected_clip_count = 0,
) {
  const trimmed_id = `${legacy_episode_id || ''}`.trim();

  if (
    !is_legacy_episode_folder_name(trimmed_id) ||
    !Number.isInteger(expected_clip_count) ||
    expected_clip_count <= 0
  ) {
    return null;
  }

  const id = build_legacy_episode_id(trimmed_id);
  const directory = new Directory(get_episodes_directory(), id);

  if (!directory.exists) {
    return null;
  }

  const existing = read_episode_from_directory(directory);

  if (
    !is_complete_episode(directory, existing) ||
    existing.clip_meta.length !== expected_clip_count
  ) {
    return null;
  }

  return existing;
}

export async function save_migrated_episode(legacy_episode = null, converted_clips = []) {
  const legacy_id = `${legacy_episode?.id || ''}`.trim();
  const expected_clip_count = legacy_episode?.clips?.length || 0;

  if (
    !is_legacy_episode_folder_name(legacy_id) ||
    expected_clip_count === 0 ||
    converted_clips.length !== expected_clip_count
  ) {
    throw new Error('A valid legacy episode is required for migration.');
  }

  const id = build_legacy_episode_id(legacy_id);
  const directory = new Directory(get_episodes_directory(), id);

  if (directory.exists) {
    const existing = read_episode_from_directory(directory);

    if (
      is_complete_episode(directory, existing) &&
      existing.clip_meta.length === expected_clip_count
    ) {
      return existing;
    }

    directory.delete();
  }

  directory.create({ intermediates: true });

  try {
    const clip_meta = [];

    for (let index = 0; index < converted_clips.length; index += 1) {
      const converted = converted_clips[index];
      const source_file = new File(`${converted?.uri || ''}`.trim());
      const segment_name = build_segment_name(index + 1, DEFAULT_SEGMENT_EXTENSION);
      const segment_file = new File(directory, segment_name);

      if (
        !source_file.exists ||
        !Number.isFinite(converted?.duration_seconds) ||
        converted.duration_seconds <= 0
      ) {
        throw new Error('A converted legacy segment is missing.');
      }

      await source_file.move(segment_file);

      const size_bytes = read_clip_size_bytes(directory, segment_name);

      if (size_bytes <= 0) {
        throw new Error('A converted legacy segment is empty.');
      }

      clip_meta.push({
        duration_seconds: converted.duration_seconds,
        name: segment_name,
        size_bytes,
        waveform: converted.waveform,
      });
    }

    const info = compose_episode_info({
      clip_meta,
      created_at: `${legacy_episode.created_at || ''}`.trim() || new Date().toISOString(),
      title: `${legacy_episode.title || ''}`.trim() || decode_legacy_folder_name(legacy_id),
    });

    write_episode_info(directory, info);

    const migrated = read_episode_from_directory(directory);

    if (
      !is_complete_episode(directory, migrated) ||
      migrated.clip_meta.length !== expected_clip_count
    ) {
      throw new Error('The migrated episode could not be verified.');
    }

    return migrated;
  } catch (error) {
    if (directory.exists) {
      directory.delete();
    }

    throw error;
  }
}

export async function delete_legacy_episode(legacy_episode_id = '') {
  const trimmed_id = `${legacy_episode_id || ''}`.trim();

  if (!is_legacy_episode_folder_name(trimmed_id)) {
    return;
  }

  const documents_directory = new Directory(Paths.document);
  const directory = documents_directory
    .list()
    .find(entry => entry instanceof Directory && entry.name === trimmed_id);

  if (directory?.exists) {
    directory.delete();
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
