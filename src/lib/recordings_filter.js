import { post_kind } from './micropub_posts';

export const RECORDING_FILTER_OPTIONS = [
  { icon: 'square.stack', id: 'all', label: 'All' },
  { icon: 'waveform', id: 'podcasts', label: 'Podcasts' },
  { icon: 'microphone', id: 'narrations', label: 'Narrations' },
];

const RECORDING_FILTER_IDS = RECORDING_FILTER_OPTIONS.map(option => option.id);

export function recording_filter_label(filter = 'all') {
  const match = RECORDING_FILTER_OPTIONS.find(option => option.id === filter);

  if (match) {
    return match.label;
  }

  return 'All';
}

export function is_recording_filter(filter = '') {
  return RECORDING_FILTER_IDS.includes(`${filter || ''}`.trim());
}

function episode_sort_key(episode = {}) {
  return `${episode.published_at || episode.created_at || ''}`.trim();
}

function post_sort_key(post = {}) {
  return `${post.published_at || ''}`.trim();
}

function sort_recording_items(items = []) {
  return items.slice().sort((first, second) => second.sort_key.localeCompare(first.sort_key));
}

export function build_recording_items({
  episodes = [],
  filter = 'all',
  posts = [],
} = {}) {
  const episode_items = episodes.map(episode => ({
    episode,
    id: `episode:${episode.id}`,
    kind: 'episode',
    sort_key: episode_sort_key(episode),
  }));
  const narration_items = posts
    .filter(post => post_kind(post.content) === 'narrated')
    .map(post => ({
      id: `narration:${post.uid}`,
      kind: 'narration',
      post,
      sort_key: post_sort_key(post),
    }));

  if (filter === 'podcasts') {
    return episode_items.slice().sort((first, second) => (
      `${second.episode.created_at || ''}`.localeCompare(`${first.episode.created_at || ''}`)
    ));
  }

  if (filter === 'narrations') {
    return sort_recording_items(narration_items);
  }

  return sort_recording_items([...episode_items, ...narration_items]);
}

export function recordings_list_status({
  episodes_did_hydrate = false,
  episodes_is_loading = false,
  filter = 'all',
  posts_did_hydrate = false,
  posts_error_message = null,
  posts_is_loading = false,
} = {}) {
  const needs_posts = filter !== 'podcasts';
  const is_loading = !episodes_did_hydrate
    || episodes_is_loading
    || (needs_posts && (!posts_did_hydrate || posts_is_loading));

  return {
    error_message: needs_posts ? `${posts_error_message || ''}`.trim() : '',
    is_loading,
  };
}

export function recordings_empty_copy(filter = 'all') {
  if (filter === 'narrations') {
    return {
      body: 'Posts with a hidden audio narration will show up here.',
      show_record: false,
      title: 'No narrations yet',
    };
  }

  if (filter === 'podcasts') {
    return {
      body: 'Tap the button to start recording. Then you can edit it and publish it to Micro.blog.',
      show_record: true,
      title: 'No podcasts yet',
    };
  }

  return {
    body: 'Tap the button to start recording. Then you can edit it and publish it to Micro.blog.',
    show_record: true,
    title: 'Record your first podcast',
  };
}
