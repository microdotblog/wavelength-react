import { applySnapshot, flow, getSnapshot, types } from 'mobx-state-tree';

import { delete_micropub_post } from '../api/Micropub';
import {
  append_clip_to_episode,
  delete_episode as remove_episode_from_storage,
  get_episode_clip_uri,
  get_exported_clip_uri,
  list_episodes,
  mark_episode_published as persist_episode_published,
  read_episode,
  replace_episode_clips,
  save_episode_from_recording,
  update_episode_title,
} from '../lib/EpisodeStorage';
import { merge_episode_clips } from '../lib/episode_audio';
import Auth from './Auth';
import Posts from './Posts';
import Tokens from './Tokens';

const ClipMeta = types.model('ClipMeta', {
  duration_seconds: types.optional(types.number, 0),
  name: types.string,
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
      const trimmed_post_id = `${post_id || ''}`.trim();

      if (!trimmed_post_id) {
        return null;
      }

      return self.episodes.find(episode => `${episode.post_id || ''}`.trim() === trimmed_post_id) || null;
    },

    has_episodes() {
      return self.episodes.length > 0;
    },
  }))
  .create();

export default Episodes;
