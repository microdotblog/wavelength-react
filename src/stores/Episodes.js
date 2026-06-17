import { applySnapshot, flow, getSnapshot, types } from 'mobx-state-tree';

import {
  append_clip_to_episode,
  delete_episode,
  get_episode_clip_uri,
  get_exported_clip_uri,
  list_episodes,
  read_episode,
  replace_episode_clips,
  save_episode_from_recording,
} from '../lib/EpisodeStorage';
import { merge_episode_clips } from '../lib/episode_audio';

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

    delete_episode: flow(function* (episode_id = '') {
      yield delete_episode(episode_id);

      const existing_episode = self.episodes.find(episode => episode.id === episode_id);

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

    has_episodes() {
      return self.episodes.length > 0;
    },
  }))
  .create();

export default Episodes;
