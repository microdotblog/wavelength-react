import { flow, types } from 'mobx-state-tree';

import { create_episode_post, upload_episode_audio } from '../api/Micropub';
import {
  apply_text_format_action,
  build_episode_publish_payload,
  post_text_length,
  should_show_title,
  toggle_list_item,
} from '../lib/publish_editor';
import Auth from './Auth';
import Episodes from './Episodes';
import Tokens from './Tokens';

const Publishing = types
  .model('Publishing', {
    available_categories: types.optional(types.array(types.string), []),
    available_syndicates: types.optional(types.array(types.string), []),
    error_message: types.maybeNull(types.string),
    new_category_text: types.optional(types.string, ''),
    post_categories: types.optional(types.array(types.string), []),
    post_content: types.optional(types.string, ''),
    post_status: types.optional(types.string, 'published'),
    post_syndicates: types.optional(types.array(types.string), []),
    post_title: types.optional(types.string, ''),
    show_title: types.optional(types.boolean, false),
    summary: types.optional(types.string, ''),
    text_selection_end: types.optional(types.number, 0),
    text_selection_start: types.optional(types.number, 0),
  })
  .volatile(() => ({
    editor_episode_id: null,
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

    reset_editor() {
      self.editor_episode_id = null;
      self.new_category_text = '';
      self.post_categories = [];
      self.post_content = '';
      self.post_status = 'published';
      self.post_syndicates = [];
      self.post_title = '';
      self.show_title = false;
      self.summary = '';
      self.text_selection_end = 0;
      self.text_selection_start = 0;
    },

    prep_editor(episode_id = '') {
      const episode = Episodes.get_episode(episode_id);

      self.editor_episode_id = `${episode_id || ''}`.trim() || null;
      self.post_title = episode?.title || '';
      self.post_content = '';
      self.post_status = 'published';
      self.post_categories = [];
      self.post_syndicates = [];
      self.new_category_text = '';
      self.show_title = false;
      self.summary = '';
      self.text_selection_end = 0;
      self.text_selection_start = 0;
    },

    set_post_title(value = '') {
      self.post_title = `${value || ''}`;
    },

    set_post_content(value = '') {
      self.post_content = `${value || ''}`;
    },

    set_summary(value = '') {
      self.summary = `${value || ''}`;
    },

    set_new_category_text(value = '') {
      self.new_category_text = `${value || ''}`;
    },

    set_text_selection(selection = { end: 0, start: 0 }) {
      self.text_selection_start = selection?.start ?? 0;
      self.text_selection_end = selection?.end ?? 0;
    },

    toggle_title() {
      self.show_title = !self.show_title;
    },

    handle_post_status_select(status = 'published') {
      const trimmed_status = `${status || ''}`.trim();

      if (trimmed_status === 'draft' || trimmed_status === 'published') {
        self.post_status = trimmed_status;
      }
    },

    handle_post_category_select(category = '') {
      const trimmed_category = `${category || ''}`.trim();

      if (!trimmed_category) {
        return;
      }

      self.post_categories = toggle_list_item(self.post_categories, trimmed_category);
    },

    handle_post_syndicates_select(syndicate_uid = '') {
      const trimmed_uid = `${syndicate_uid || ''}`.trim();

      if (!trimmed_uid) {
        return;
      }

      self.post_syndicates = toggle_list_item(self.post_syndicates, trimmed_uid);
    },

    handle_text_action(action = 'bold') {
      const result = apply_text_format_action(self.post_content, {
        end: self.text_selection_end,
        start: self.text_selection_start,
      }, action);

      self.post_content = result.text;
      self.text_selection_start = result.selection.start;
      self.text_selection_end = result.selection.end;
    },

    publish_episode: flow(function* (episode_id = '', overrides = {}) {
      if (self.is_publishing) {
        return null;
      }

      const token = Tokens.get_user_token();

      if (!token) {
        self.set_error('You need to be signed in to Micro.blog to publish.');
        return null;
      }

      const destination = `${Auth.default_site || ''}`.trim();
      const payload = build_episode_publish_payload({
        categories: overrides.categories ?? self.post_categories,
        content: overrides.content ?? self.post_content,
        status: overrides.status ?? self.post_status,
        summary: overrides.summary ?? self.summary,
        title: overrides.title ?? self.post_title,
      });

      self.is_publishing = true;
      self.error_message = null;
      self.last_post_url = '';

      try {
        self.phase = 'exporting';
        const exported_uri = yield Episodes.export_merged_audio(episode_id);

        if (!exported_uri) {
          throw new Error('We could not prepare this episode for publishing.');
        }

        self.phase = 'uploading';
        const audio_url = yield upload_episode_audio({
          destination,
          file_uri: exported_uri,
          token,
        });

        self.phase = 'posting';
        const post_url = yield create_episode_post({
          audio_url,
          categories: payload.categories,
          content: payload.content,
          destination,
          status: payload.status,
          title: payload.title,
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
    post_button_label() {
      return self.post_status === 'draft' ? 'Save' : 'Post';
    },

    post_text_length() {
      return post_text_length(self.post_content);
    },

    should_show_title() {
      return should_show_title({
        content_length: self.post_text_length(),
        show_title: self.show_title,
        title: self.post_title,
      });
    },

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