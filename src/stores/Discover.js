import { applySnapshot, flow, types } from 'mobx-state-tree';

import { DISCOVER_PODCASTS_TOPIC, fetch_discover_posts } from '../api/Discover';
import { normalize_discover_posts } from '../lib/discover_posts';
import Tokens from './Tokens';

const DiscoverPost = types.model('DiscoverPost', {
  author_avatar: types.optional(types.string, ''),
  author_name: types.optional(types.string, ''),
  author_url: types.optional(types.string, ''),
  author_username: types.optional(types.string, ''),
  date_relative: types.optional(types.string, ''),
  id: types.identifier,
  published_at: types.optional(types.string, ''),
  summary: types.optional(types.string, ''),
  title: types.optional(types.string, ''),
  url: types.string,
});

const Discover = types
  .model('Discover', {
    posts: types.array(DiscoverPost),
    topic: types.optional(types.string, DISCOVER_PODCASTS_TOPIC),
  })
  .volatile(() => ({
    did_hydrate: false,
    error_message: null,
    has_more: true,
    is_loading: false,
    is_loading_more: false,
  }))
  .actions(self => ({
    clear_error() {
      self.error_message = null;
    },

    set_error(message = null) {
      self.error_message = `${message || ''}`.trim() || null;
    },

    refresh: flow(function* () {
      self.is_loading = true;
      self.error_message = null;
      self.has_more = true;

      try {
        const payload = yield fetch_discover_posts({
          token: Tokens.get_user_token(),
          topic: self.topic,
        });
        const posts = normalize_discover_posts(payload);

        applySnapshot(self.posts, posts);
        self.has_more = posts.length >= 40;
      } catch (error) {
        applySnapshot(self.posts, []);
        self.set_error(error?.message || 'We could not load Discover posts.');
        self.has_more = false;
      } finally {
        self.did_hydrate = true;
        self.is_loading = false;
      }
    }),

    load_more: flow(function* () {
      if (!self.has_more || self.is_loading || self.is_loading_more || self.posts.length === 0) {
        return;
      }

      const before_id = self.posts[self.posts.length - 1]?.id || '';

      if (!before_id) {
        return;
      }

      self.is_loading_more = true;
      self.error_message = null;

      try {
        const payload = yield fetch_discover_posts({
          before_id,
          token: Tokens.get_user_token(),
          topic: self.topic,
        });
        const posts = normalize_discover_posts(payload);
        const existing_ids = new Set(self.posts.map(post => post.id));

        for (const post of posts) {
          if (!existing_ids.has(post.id)) {
            self.posts.push(post);
          }
        }

        self.has_more = posts.length >= 40;
      } catch (error) {
        self.set_error(error?.message || 'We could not load more Discover posts.');
      } finally {
        self.is_loading_more = false;
      }
    }),
  }))
  .views(self => ({
    sorted_posts() {
      return self.posts
        .slice()
        .sort((first, second) => second.published_at.localeCompare(first.published_at));
    },
  }))
  .create();

export default Discover;
