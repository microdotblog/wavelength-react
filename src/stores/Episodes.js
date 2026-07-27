import { applySnapshot, flow, getSnapshot, types } from 'mobx-state-tree';

import { delete_micropub_post } from '../api/Micropub';
import {
  append_clip_to_episode,
  delete_episode as remove_episode_from_storage,
  clear_episode_publish_link as clear_episode_publish_link_in_storage,
  duplicate_episode as copy_episode_in_storage,
  get_episode_clip_uri,
  get_exported_clip_uri,
  list_episodes,
  mark_episode_published as persist_episode_published,
  read_episode,
  replace_episode_clips,
  save_episode_from_recording,
  update_episode_title,
} from '../lib/EpisodeStorage';
import {
  delete_audio_file,
  merge_episode_clips,
  normalize_imported_audio,
} from '../lib/episode_audio';
import {
  format_file_size,
  is_over_upload_limit,
  sanitize_size_bytes,
} from '../lib/episode_upload_size';
import Auth from './Auth';
import Posts from './Posts';
import Tokens from './Tokens';

const ClipMeta = types.model('ClipMeta', {
  duration_seconds: types.optional(types.number, 0),
  name: types.string,
  size_bytes: types.optional(types.number, 0),
  waveform: types.optional(types.array(types.number), []),
});

const Episode = types
  .model('Episode', {
    clip_meta: types.optional(types.array(ClipMeta), []),
    clips: types.array(types.string),
    created_at: types.string,
    duration_seconds: types.optional(types.number, 0),
    folder_uri: types.string,
    id: types.identifier,
    post_id: types.maybeNull(types.string),
    post_url: types.maybeNull(types.string),
    published_at: types.maybeNull(types.string),
    title: types.string,
    waveform: types.optional(types.array(types.number), []),
  })
  .views(self => ({
    primary_clip_uri() {
      return get_episode_clip_uri(self, self.clips[0]);
    },

    clip_uri(clip_name) {
      return get_episode_clip_uri(self, clip_name);
    },

    exported_uri() {
      return get_exported_clip_uri(self);
    },

    playback_clips() {
      return self.clip_meta.map(clip => ({
        duration_seconds: clip.duration_seconds,
        name: clip.name,
        uri: get_episode_clip_uri(self, clip.name),
      }));
    },

    is_published() {
      return `${self.post_id || self.post_url || ''}`.trim().length > 0;
    },

    total_audio_size_bytes() {
      return self.clip_meta.reduce(
        (sum, clip) => sum + sanitize_size_bytes(clip.size_bytes),
        0,
      );
    },

    formatted_audio_size() {
      return format_file_size(self.total_audio_size_bytes());
    },

    is_over_upload_limit() {
      return is_over_upload_limit(self.total_audio_size_bytes());
    },
  }));

const Episodes = types
  .model('Episodes', {
    episodes: types.array(Episode),
  })
  .volatile(() => ({
    did_hydrate: false,
    export_fingerprints: {},
    is_loading: false,
  }))
  .actions(self => ({
    apply_episode_snapshot(snapshot) {
      const existing = self.episodes.find(episode => episode.id === snapshot.id);

      if (existing) {
        applySnapshot(existing, snapshot);
      } else {
        self.episodes.push(snapshot);
      }
    },

    refresh: flow(function* () {
      self.is_loading = true;

      try {
        const loaded_episodes = yield list_episodes();
        applySnapshot(self.episodes, loaded_episodes);
        self.did_hydrate = true;
      } catch (error) {
        self.did_hydrate = true;
      }

      self.is_loading = false;
    }),

    refresh_episode: flow(function* (episode_id = '') {
      const snapshot = yield read_episode(episode_id);

      if (snapshot) {
        self.apply_episode_snapshot(snapshot);
      }

      return snapshot;
    }),

    create_from_recording: flow(function* (recording_uri = '', duration_seconds = 0, waveform = []) {
      const episode = yield save_episode_from_recording(recording_uri, duration_seconds, waveform);
      self.episodes.push(episode);

      return episode.id;
    }),

    append_clip_to_episode: flow(function* (episode_id = '', recording_uri = '', duration_seconds = 0, waveform = []) {
      const snapshot = yield append_clip_to_episode(episode_id, recording_uri, duration_seconds, waveform);
      self.apply_episode_snapshot(snapshot);
      delete self.export_fingerprints[episode_id];

      return snapshot.id;
    }),

    import_clip_to_episode: flow(function* (episode_id = '', source_uri = '') {
      let normalized_uri = '';

      try {
        const normalized = yield normalize_imported_audio(source_uri);
        normalized_uri = normalized.uri;

        const snapshot = yield append_clip_to_episode(
          episode_id,
          normalized.uri,
          normalized.duration_seconds,
          normalized.waveform,
        );
        self.apply_episode_snapshot(snapshot);
        delete self.export_fingerprints[episode_id];

        return snapshot.id;
      } finally {
        if (normalized_uri) {
          delete_audio_file(normalized_uri);
        }
      }
    }),

    update_episode_clips: flow(function* (episode_id = '', clip_meta = []) {
      const snapshot = yield replace_episode_clips(episode_id, clip_meta);
      self.apply_episode_snapshot(snapshot);
      delete self.export_fingerprints[episode_id];

      return snapshot.id;
    }),

    update_episode_title: flow(function* (episode_id = '', title = '') {
      const snapshot = yield update_episode_title(episode_id, title);
      self.apply_episode_snapshot(snapshot);

      return snapshot.id;
    }),

    duplicate_episode: flow(function* (episode_id = '') {
      const snapshot = yield copy_episode_in_storage(episode_id);
      self.episodes.push(snapshot);

      return snapshot.id;
    }),

    clear_publish_link: flow(function* (episode_id = '') {
      const snapshot = yield clear_episode_publish_link_in_storage(episode_id);
      self.apply_episode_snapshot(snapshot);

      return snapshot.id;
    }),

    delete_episode: flow(function* (episode_id = '', { delete_post = false } = {}) {
      const existing_episode = self.episodes.find(episode => episode.id === episode_id);

      if (delete_post && existing_episode) {
        const post_url = `${existing_episode.post_url || ''}`.trim();

        if (post_url) {
          const token = Tokens.get_user_token();

          if (!token) {
            throw new Error('You need to be signed in to Micro.blog to delete a post.');
          }

          const destination = `${Auth.default_site || ''}`.trim();

          yield delete_micropub_post({
            destination,
            post_url,
            token,
          });
          yield Posts.refresh();
        }
      }

      yield remove_episode_from_storage(episode_id);

      if (existing_episode) {
        self.episodes.remove(existing_episode);
      }

      delete self.export_fingerprints[episode_id];
    }),

    export_merged_audio: flow(function* (episode_id = '') {
      const episode = self.episodes.find(item => item.id === episode_id);

      if (!episode || episode.clips.length === 0) {
        return '';
      }

      const fingerprint = episode.clips.join('|');

      if (self.export_fingerprints[episode_id] === fingerprint) {
        return episode.exported_uri();
      }

      try {
        const exported_uri = yield merge_episode_clips(getSnapshot(episode));
        self.export_fingerprints[episode_id] = fingerprint;

        return exported_uri;
      } catch (error) {
        return '';
      }
    }),

    mark_episode_published: flow(function* (episode_id = '', publish_result = {}) {
      const snapshot = yield persist_episode_published(episode_id, publish_result);
      self.apply_episode_snapshot(snapshot);

      return snapshot;
    }),
  }))
  .views(self => ({
    sorted_episodes() {
      return self.episodes
        .slice()
        .sort((first, second) => second.created_at.localeCompare(first.created_at));
    },

    get_episode(episode_id = '') {
      return self.episodes.find(episode => episode.id === episode_id) || null;
    },

    get_episode_by_post_id(post_id = '') {
      return self.get_episode_for_post({ post_id });
    },

    get_episode_for_post({ post_id = '', post_url = '' } = {}) {
      const trimmed_post_id = `${post_id || ''}`.trim();
      const trimmed_post_url = `${post_url || ''}`.trim();

      if (trimmed_post_id) {
        const by_post_id = self.episodes.find(
          episode => `${episode.post_id || ''}`.trim() === trimmed_post_id,
        );

        if (by_post_id) {
          return by_post_id;
        }
      }

      if (trimmed_post_url) {
        return self.episodes.find(
          episode => `${episode.post_url || ''}`.trim() === trimmed_post_url,
        ) || null;
      }

      return null;
    },

    has_episodes() {
      return self.episodes.length > 0;
    },
  }))
  .create();

export default Episodes;
