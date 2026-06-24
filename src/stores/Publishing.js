import { flow, types } from 'mobx-state-tree';

import { create_episode_post, upload_episode_audio } from '../api/Micropub';
import Auth from './Auth';
import Episodes from './Episodes';
import Tokens from './Tokens';

const Publishing = types
  .model('Publishing', {
    error_message: types.maybeNull(types.string),
  })
  .volatile(() => ({
    is_publishing: false,
    last_post_url: '',
    phase: 'idle',
  }))
  .actions(self => ({
    clear_error() {
      self.error_message = null;
    },

    set_error(message = null) {
      self.error_message = message;
    },

    reset() {
      self.error_message = null;
      self.last_post_url = '';
      self.phase = 'idle';
    },

    publish_episode: flow(function* (episode_id = '', { content = '', title = '' } = {}) {
      if (self.is_publishing) {
        return null;
      }

      const token = Tokens.get_user_token();

      if (!token) {
        self.set_error('You need to be signed in to Micro.blog to publish.');
        return null;
      }

      self.is_publishing = true;
      self.error_message = null;
      self.last_post_url = '';

      try {
        self.phase = 'exporting';
        const exported_uri = yield Episodes.export_merged_audio(episode_id);

        if (!exported_uri) {
          throw new Error('We could not prepare this episode for publishing.');
        }

        const destination = `${Auth.default_site || ''}`.trim();

        self.phase = 'uploading';
        const audio_url = yield upload_episode_audio({
          destination,
          file_uri: exported_uri,
          token,
        });

        self.phase = 'posting';
        const post_url = yield create_episode_post({
          audio_url,
          content,
          destination,
          title,
          token,
        });

        self.phase = 'done';
        self.last_post_url = post_url;

        return post_url;
      } catch (error) {
        self.set_error(error?.message || 'We could not publish the episode. Please try again.');
        self.phase = 'idle';

        return null;
      } finally {
        self.is_publishing = false;
      }
    }),
  }))
  .views(self => ({
    status_label() {
      if (self.phase === 'exporting') {
        return 'Preparing audio…';
      }

      if (self.phase === 'uploading') {
        return 'Uploading audio…';
      }

      if (self.phase === 'posting') {
        return 'Posting to Micro.blog…';
      }

      return '';
    },
  }))
  .create();

export default Publishing;
