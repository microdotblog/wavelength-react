import { applySnapshot, flow, types } from 'mobx-state-tree';

import {
  delete_episode,
  get_episode_clip_uri,
  list_episodes,
  save_episode_from_recording,
} from '../lib/EpisodeStorage';

const Episode = types
  .model('Episode', {
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
  }));

const Episodes = types
  .model('Episodes', {
    episodes: types.array(Episode),
  })
  .volatile(() => ({
    did_hydrate: false,
    is_loading: false,
  }))
  .actions(self => ({
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

    create_from_recording: flow(function* (recording_uri = '', duration_seconds = 0, waveform = []) {
      const episode = yield save_episode_from_recording(recording_uri, duration_seconds, waveform);
      self.episodes.push(episode);

      return episode.id;
    }),

    delete_episode: flow(function* (episode_id = '') {
      yield delete_episode(episode_id);

      const existing_episode = self.episodes.find(episode => episode.id === episode_id);

      if (existing_episode) {
        self.episodes.remove(existing_episode);
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
