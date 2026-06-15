import { Directory, File, Paths } from 'expo-file-system';

const EPISODES_DIR_NAME = 'episodes';
const EPISODE_INFO_FILENAME = 'episode.json';
const SEGMENT_BASENAME = 'segment';
const DEFAULT_SEGMENT_EXTENSION = '.m4a';

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

    return {
      clips,
      created_at: `${parsed.created_at || ''}`,
      duration_seconds: Number.isFinite(parsed.duration_seconds) ? parsed.duration_seconds : 0,
      folder_uri: normalize_folder_uri(directory.uri),
      id: directory.name,
      title: `${parsed.title || directory.name}`,
      waveform: sanitize_waveform(parsed.waveform),
    };
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
  const segment_name = `${SEGMENT_BASENAME}${extension}`;
  const segment_file = new File(directory, segment_name);

  await source_file.move(segment_file);

  const title = build_episode_title(created_at);
  const info_file = new File(directory, EPISODE_INFO_FILENAME);
  const episode_info = {
    clips: [segment_name],
    created_at: created_at.toISOString(),
    duration_seconds: Number.isFinite(duration_seconds) ? duration_seconds : 0,
    title,
    waveform: sanitize_waveform(waveform),
  };

  info_file.write(JSON.stringify(episode_info, null, 2));

  return {
    ...episode_info,
    folder_uri: normalize_folder_uri(directory.uri),
    id,
  };
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
  const trimmed_id = `${episode_id || ''}`.trim();

  if (!trimmed_id) {
    return;
  }

  const episodes_directory = get_episodes_directory();
  const directory = new Directory(episodes_directory, trimmed_id);

  if (directory.exists) {
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
