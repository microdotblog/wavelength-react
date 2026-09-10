import { applySnapshot, flow, types } from 'mobx-state-tree';

import { delete_micropub_post, fetch_micropub_posts } from '../api/Micropub';
import { attach_narration_to_post } from '../lib/attach_narration';
import { normalize_micropub_posts, post_kind } from '../lib/micropub_posts';
import Auth from './Auth';
import Tokens from './Tokens';

const POST_FILTERS = ['all', 'posts', 'podcasts', 'narrated'];
const FILTER_TO_KIND = {
  narrated: 'narrated',
  podcasts: 'podcast',
  posts: 'post',
};

const Post = types.model('Post', {
  content: types.optional(types.string, ''),
  post_status: types.optional(types.string, 'published'),
  published_at: types.optional(types.string, ''),
  title: types.optional(types.string, ''),
  uid: types.identifier,
  url: types.string,
});

const Posts = types
  .model('Posts', {
    posts: types.array(Post),
    selected_filter: types.optional(types.string, 'podcasts'),
  })
  .volatile(() => ({
    attach_phase: 'idle',
    did_hydrate: false,
    error_message: null,
    is_attaching: false,
    is_loading: false,
  }))
  .actions(self => ({
    clear_error() {
      self.error_message = null;
    },

    set_error(message = null) {
      self.error_message = `${message || ''}`.trim() || null;
    },

    set_selected_filter(filter = 'all') {
      const trimmed_filter = `${filter || ''}`.trim();

      if (!POST_FILTERS.includes(trimmed_filter)) {
        return;
      }

      self.selected_filter = trimmed_filter;
    },

    refresh: flow(function* () {
      if (self.is_loading) {
        return;
      }

      const token = Tokens.get_user_token();

      if (!token) {
        applySnapshot(self.posts, []);
        self.did_hydrate = true;
        return;
      }

      const destination = `${Auth.default_site || ''}`.trim();

      self.is_loading = true;
      self.error_message = null;

      try {
        const payload = yield fetch_micropub_posts({ destination, token });
        applySnapshot(self.posts, normalize_micropub_posts(payload));
      } catch (error) {
        self.set_error(error?.message || 'We could not load your posts.');
      } finally {
        self.did_hydrate = true;
        self.is_loading = false;
      }
    }),

    delete_post: flow(function* (post_uid = '') {
      const post = self.get_post(post_uid);
      const post_url = `${post?.url || ''}`.trim();

      if (!post_url) {
        throw new Error('This post is no longer available.');
      }

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

      self.posts.remove(post);

      return true;
    }),

    attach_narration: flow(function* (post_uid = '', file_uri = '') {
      const post = self.get_post(post_uid);
      const post_url = `${post?.url || ''}`.trim();
      const trimmed_uri = `${file_uri || ''}`.trim();

      if (!post_url) {
        throw new Error('This post is no longer available.');
      }

      if (!trimmed_uri) {
        throw new Error('This recording has no audio to upload.');
      }

      const token = Tokens.get_user_token();

      if (!token) {
        throw new Error('You need to be signed in to Micro.blog to add narration.');
      }

      const destination = `${Auth.default_site || ''}`.trim();

      self.is_attaching = true;
      self.attach_phase = 'uploading';

      try {
        const result = yield attach_narration_to_post({
          destination,
          file_name: 'narration.m4a',
          file_uri: trimmed_uri,
          post_url,
          token,
        });

        post.content = result.content;

        return result;
      } finally {
        self.attach_phase = 'idle';
        self.is_attaching = false;
      }
    }),
  }))
  .views(self => ({
    sorted_posts() {
      return self.posts
        .slice()
        .sort((first, second) => second.published_at.localeCompare(first.published_at));
    },

    filtered_posts() {
      const posts = self.sorted_posts();
      const kind = FILTER_TO_KIND[self.selected_filter];

      if (!kind) {
        return posts;
      }

      return posts.filter(post => post_kind(post.content) === kind);
    },

    has_posts() {
      return self.posts.length > 0;
    },

    get_post(post_uid = '') {
      const trimmed_uid = `${post_uid || ''}`.trim();

      if (!trimmed_uid) {
        return null;
      }

      return self.posts.find(post => post.uid === trimmed_uid) || null;
    },
  }))
  .create();

export default Posts;
