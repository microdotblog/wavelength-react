import { flow, types } from 'mobx-state-tree';

import {
  create_episode_post,
  fetch_micropub_categories,
  fetch_micropub_post_id,
  fetch_micropub_post_source,
  fetch_micropub_syndicate_targets,
  update_micropub_post,
  upload_episode_audio,
} from '../api/Micropub';
import {
  apply_text_format_action,
  build_episode_audio_filename,
  build_episode_publish_payload,
  has_publishable_post_text,
  normalize_micropub_categories,
  normalize_micropub_syndicates,
  post_text_length,
  should_show_title,
  toggle_list_item,
} from '../lib/publish_editor';
import {
  build_upload_size_limit_message,
  is_over_upload_limit,
} from '../lib/episode_upload_size';
import { read_file_size_bytes } from '../lib/EpisodeStorage';
import Auth from './Auth';
import Episodes from './Episodes';
import Posts from './Posts';
import Tokens from './Tokens';

const SyndicateOption = types.model('SyndicateOption', {
  name: types.string,
  uid: types.string,
});

const Publishing = types
  .model('Publishing', {
    available_categories: types.optional(types.array(types.string), []),
    available_syndicates: types.optional(types.array(SyndicateOption), []),
    error_message: types.maybeNull(types.string),
    is_editing_post: types.optional(types.boolean, false),
    new_category_text: types.optional(types.string, ''),
    post_categories: types.optional(types.array(types.string), []),
    post_content: types.optional(types.string, ''),
    post_status: types.optional(types.string, 'published'),
    post_syndicates: types.optional(types.array(types.string), []),
    post_title: types.optional(types.string, ''),
    post_uid: types.maybeNull(types.string),
    post_url: types.maybeNull(types.string),
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
      self.is_editing_post = false;
      self.new_category_text = '';
      self.post_categories = [];
      self.post_content = '';
      self.post_status = 'published';
      self.post_syndicates = [];
      self.post_title = '';
      self.post_uid = null;
      self.post_url = null;
      self.show_title = false;
      self.summary = '';
      self.text_selection_end = 0;
      self.text_selection_start = 0;
    },

    prep_post_edit(post = {}, { episode_id = null } = {}) {
      const trimmed_uid = `${post?.uid || ''}`.trim();
      const trimmed_url = `${post?.url || ''}`.trim();
      const trimmed_title = `${post?.title || ''}`.trim();
      const trimmed_episode_id = `${episode_id || ''}`.trim();
      const linked_episode = trimmed_episode_id
        ? Episodes.get_episode(trimmed_episode_id)
        : Episodes.get_episode_for_post({ post_id: trimmed_uid, post_url: trimmed_url });

      self.is_editing_post = true;
      self.post_uid = trimmed_uid || null;
      self.post_url = trimmed_url || null;
      self.post_title = trimmed_title;
      self.post_content = `${post?.content || ''}`;
      self.post_status = `${post?.post_status || 'published'}`.trim() || 'published';
      self.post_categories = [];
      self.post_syndicates = [];
      self.new_category_text = '';
      self.show_title = trimmed_title.length > 0;
      self.summary = '';
      self.text_selection_end = 0;
      self.text_selection_start = 0;
      self.editor_episode_id = linked_episode?.id || null;
    },

    relink_editor_episode() {
      if (!self.is_editing_post) {
        return;
      }

      const linked_episode = Episodes.get_episode_for_post({
        post_id: self.post_uid,
        post_url: self.post_url,
      });

      self.editor_episode_id = linked_episode?.id || null;
    },

    load_post_source: flow(function* () {
      const post_url = `${self.post_url || ''}`.trim();

      if (!post_url) {
        return;
      }

      const token = Tokens.get_user_token();

      if (!token) {
        return;
      }

      const destination = `${Auth.default_site || ''}`.trim();
      const source = yield fetch_micropub_post_source({ destination, post_url, token });

      if (!source) {
        return;
      }

      if (source.title) {
        self.post_title = source.title;
      }

      if (source.content) {
        self.post_content = source.content;
      }

      if (source.post_status) {
        self.post_status = source.post_status;
      }

      if (source.uid) {
        self.post_uid = `${source.uid}`.trim();
      }

      self.post_categories = source.categories || [];
      self.summary = source.summary || '';
      self.show_title = self.show_title || self.post_title.length > 0;
      self.relink_editor_episode();
    }),

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

    load_editor_options: flow(function* () {
      const token = Tokens.get_user_token();

      if (!token) {
        return;
      }

      const destination = `${Auth.default_site || ''}`.trim();

      try {
        const categories_payload = yield fetch_micropub_categories({ destination, token });
        self.available_categories = normalize_micropub_categories(categories_payload);
      } catch {
        self.available_categories = [];
      }

      try {
        const syndicates_payload = yield fetch_micropub_syndicate_targets({ destination, token });
        self.available_syndicates = normalize_micropub_syndicates(syndicates_payload);
      } catch {
        self.available_syndicates = [];
      }
    }),

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
        syndicates: overrides.syndicates ?? self.post_syndicates,
        title: overrides.title ?? self.post_title,
      });

      if (!has_publishable_post_text({
        content: payload.content,
        summary: payload.summary,
      })) {
        self.set_error('There is nothing to post. Type something to get started.');
        return null;
      }

      self.is_publishing = true;
      self.error_message = null;
      self.last_post_url = '';

      try {
        self.phase = 'exporting';
        const exported_uri = yield Episodes.export_published_audio(episode_id);

        if (!exported_uri) {
          throw new Error('We could not prepare this episode for publishing.');
        }

        const exported_size_bytes = read_file_size_bytes(exported_uri);

        if (is_over_upload_limit(exported_size_bytes)) {
          throw new Error(build_upload_size_limit_message(exported_size_bytes));
        }

        self.phase = 'uploading';
        const audio_url = yield upload_episode_audio({
          destination,
          file_name: build_episode_audio_filename(payload.title),
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
          summary: payload.summary,
          syndicates: payload.syndicates,
          title: payload.title,
          token,
        });

        self.phase = 'done';
        self.last_post_url = post_url;

        if (payload.status === 'published' && post_url) {
          const post_id = yield fetch_micropub_post_id({
            destination,
            post_url,
            token,
          });

          yield Episodes.mark_episode_published(episode_id, { post_id, post_url });
          yield Posts.refresh();
        }

        return post_url;
      } catch (error) {
        self.set_error(error?.message || 'We could not publish the episode. Please try again.');
        self.phase = 'idle';

        return null;
      } finally {
        self.is_publishing = false;
      }
    }),

    update_post: flow(function* () {
      if (self.is_publishing || !self.is_editing_post) {
        return false;
      }

      const token = Tokens.get_user_token();

      if (!token) {
        self.set_error('You need to be signed in to Micro.blog to update a post.');
        return false;
      }

      const post_url = `${self.post_url || ''}`.trim();

      if (!post_url) {
        self.set_error('This post is no longer available.');
        return false;
      }

      const destination = `${Auth.default_site || ''}`.trim();

      if (!has_publishable_post_text({
        content: self.post_content,
        summary: self.summary,
      })) {
        self.set_error('There is nothing to post. Type something to get started.');
        return false;
      }

      self.is_publishing = true;
      self.error_message = null;

      try {
        yield update_micropub_post({
          categories: self.post_categories,
          content: self.post_content,
          destination,
          post_url,
          status: self.post_status,
          summary: self.summary,
          title: self.post_title,
          token,
        });
        yield Posts.refresh();

        return true;
      } catch (error) {
        self.set_error(error?.message || 'We could not update the post. Please try again.');

        return false;
      } finally {
        self.is_publishing = false;
      }
    }),
  }))
  .views(self => ({
    post_button_label() {
      if (self.is_editing_post) {
        return 'Update';
      }

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
