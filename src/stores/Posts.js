import { applySnapshot, flow, types } from 'mobx-state-tree';

import { delete_micropub_post, fetch_micropub_posts } from '../api/Micropub';
import { normalize_micropub_posts } from '../lib/micropub_posts';
import Auth from './Auth';
import Tokens from './Tokens';

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
  })
  .volatile(() => ({
    did_hydrate: false,
    error_message: null,
    is_loading: false,
  }))
  .actions(self => ({
    clear_error() {
      self.error_message = null;
    },

    set_error(message = null) {
      self.error_message = `${message || ''}`.trim() || null;
    },

    refresh: flow(function* () {
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
  }))
  .views(self => ({
    sorted_posts() {
      return self.posts
        .slice()
        .sort((first, second) => second.published_at.localeCompare(first.published_at));
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
