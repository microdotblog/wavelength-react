import { applySnapshot, flow, types } from 'mobx-state-tree';

import {
  DISCOVER_PAGE_SIZE,
  DISCOVER_PODCASTS_TOPIC,
  LISTEN_LATER_PAGE_SIZE,
  fetch_discover_posts,
  fetch_listen_later_posts,
  remove_listen_later as delete_listen_later,
} from '../api/Discover';
import { is_playable_discover_post, normalize_discover_posts } from '../lib/discover_posts';
import Tokens from './Tokens';

const DISCOVER_FILTERS = ['discover', 'listen_later'];

const DiscoverPost = types.model('DiscoverPost', {
  author_avatar: types.optional(types.string, ''),
  author_name: types.optional(types.string, ''),
  author_url: types.optional(types.string, ''),
  author_username: types.optional(types.string, ''),
  audio_url: types.optional(types.string, ''),
  date_relative: types.optional(types.string, ''),
  duration_display: types.optional(types.string, ''),
  duration_seconds: types.optional(types.number, 0),
  id: types.identifier,
  image_url: types.optional(types.string, ''),
  is_podcast: types.optional(types.boolean, false),
  published_at: types.optional(types.string, ''),
  summary: types.optional(types.string, ''),
  title: types.optional(types.string, ''),
  url: types.string,
});

function find_post(self, post_id = '') {
  const trimmed_post_id = `${post_id || ''}`.trim();

  if (!trimmed_post_id) {
    return null;
  }

  let primary_posts = self.posts;
  let secondary_posts = self.listen_later_posts;

  if (self.selected_filter === 'listen_later') {
    primary_posts = self.listen_later_posts;
    secondary_posts = self.posts;
  }

  const primary_post = primary_posts.find(item => item.id === trimmed_post_id);

  if (primary_post) {
    return primary_post;
  }

  const secondary_post = secondary_posts.find(item => item.id === trimmed_post_id);

  if (secondary_post) {
    return secondary_post;
  } else {
    return null;
  }
}

function sort_discover_posts(posts = []) {
  return posts
    .slice()
    .sort((first, second) => second.published_at.localeCompare(first.published_at));
}

const Discover = types
  .model('Discover', {
    listen_later_posts: types.array(DiscoverPost),
    posts: types.array(DiscoverPost),
    selected_filter: types.optional(types.string, 'discover'),
    topic: types.optional(types.string, DISCOVER_PODCASTS_TOPIC),
  })
  .volatile(() => ({
    active_post_id: null,
    did_hydrate: false,
    error_message: null,
    has_more: true,
    is_loading: false,
    is_loading_more: false,
    listen_later_did_hydrate: false,
    listen_later_has_more: true,
    listen_later_is_loading: false,
    listen_later_is_loading_more: false,
  }))
  .actions(self => ({
    clear_playback() {
      self.active_post_id = null;
    },

    clear_error() {
      self.error_message = null;
    },

    play_post(post_id = '') {
      const trimmed_post_id = `${post_id || ''}`.trim();

      if (!trimmed_post_id) {
        self.active_post_id = null;
        return;
      }

      const post = find_post(self, trimmed_post_id);

      if (!post || !is_playable_discover_post(post)) {
        return;
      }

      self.active_post_id = trimmed_post_id;
    },

    set_error(message = null) {
      self.error_message = `${message || ''}`.trim() || null;
    },

    set_selected_filter(filter = 'discover') {
      const trimmed_filter = `${filter || ''}`.trim();

      if (!DISCOVER_FILTERS.includes(trimmed_filter)) {
        return;
      }

      self.selected_filter = trimmed_filter;
    },

    refresh: flow(function* () {
      if (self.selected_filter === 'listen_later') {
        yield self.refresh_listen_later();
        return;
      }

      yield self.refresh_discover();
    }),

    refresh_discover: flow(function* () {
      if (self.is_loading) {
        return;
      }

      self.is_loading = true;
      self.has_more = true;

      if (self.selected_filter !== 'listen_later') {
        self.error_message = null;
      }

      try {
        const payload = yield fetch_discover_posts({
          token: Tokens.get_user_token(),
          topic: self.topic,
        });
        const posts = normalize_discover_posts(payload);

        applySnapshot(self.posts, posts);
        self.has_more = posts.length >= DISCOVER_PAGE_SIZE;
      } catch (error) {
        applySnapshot(self.posts, []);
        self.has_more = false;

        if (self.selected_filter !== 'listen_later') {
          self.set_error(error?.message || 'We could not load Discover posts.');
        }
      } finally {
        self.did_hydrate = true;
        self.is_loading = false;
      }
    }),

    refresh_listen_later: flow(function* () {
      if (self.listen_later_is_loading) {
        return;
      }

      self.listen_later_is_loading = true;
      self.listen_later_has_more = true;

      if (self.selected_filter === 'listen_later') {
        self.error_message = null;
      }

      try {
        const payload = yield fetch_listen_later_posts({
          token: Tokens.get_user_token(),
        });
        const posts = normalize_discover_posts(payload);

        applySnapshot(self.listen_later_posts, posts);
        self.listen_later_has_more = posts.length >= LISTEN_LATER_PAGE_SIZE;
      } catch (error) {
        applySnapshot(self.listen_later_posts, []);
        self.listen_later_has_more = false;

        if (self.selected_filter === 'listen_later') {
          self.set_error(error?.message || 'We could not load Listen Later.');
        }
      } finally {
        self.listen_later_did_hydrate = true;
        self.listen_later_is_loading = false;
      }
    }),

    load_more: flow(function* () {
      if (self.selected_filter === 'listen_later') {
        yield self.load_more_listen_later();
        return;
      }

      yield self.load_more_discover();
    }),

    load_more_discover: flow(function* () {
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

        self.has_more = posts.length >= DISCOVER_PAGE_SIZE;
      } catch (error) {
        self.set_error(error?.message || 'We could not load more Discover posts.');
      } finally {
        self.is_loading_more = false;
      }
    }),

    load_more_listen_later: flow(function* () {
      if (
        !self.listen_later_has_more
        || self.listen_later_is_loading
        || self.listen_later_is_loading_more
        || self.listen_later_posts.length === 0
      ) {
        return;
      }

      const before_id = self.listen_later_posts[self.listen_later_posts.length - 1]?.id || '';

      if (!before_id) {
        return;
      }

      self.listen_later_is_loading_more = true;
      self.error_message = null;

      try {
        const payload = yield fetch_listen_later_posts({
          before_id,
          token: Tokens.get_user_token(),
        });
        const posts = normalize_discover_posts(payload);
        const existing_ids = new Set(self.listen_later_posts.map(post => post.id));

        for (const post of posts) {
          if (!existing_ids.has(post.id)) {
            self.listen_later_posts.push(post);
          }
        }

        self.listen_later_has_more = posts.length >= LISTEN_LATER_PAGE_SIZE;
      } catch (error) {
        self.set_error(error?.message || 'We could not load more Listen Later episodes.');
      } finally {
        self.listen_later_is_loading_more = false;
      }
    }),

    remove_listen_later: flow(function* (post_id = '') {
      const trimmed_post_id = `${post_id || ''}`.trim();
      const post = self.listen_later_posts.find(item => item.id === trimmed_post_id);

      if (!post) {
        throw new Error('This episode is no longer in Listen Later.');
      }

      const token = Tokens.get_user_token();

      if (!token) {
        throw new Error('You need to be signed in to Micro.blog to remove Listen Later episodes.');
      }

      yield delete_listen_later({
        id: trimmed_post_id,
        token,
      });

      if (self.active_post_id === trimmed_post_id) {
        self.active_post_id = null;
      }

      self.listen_later_posts.remove(post);
      return true;
    }),
  }))
  .views(self => ({
    active_post() {
      if (!self.active_post_id) {
        return null;
      }

      return find_post(self, self.active_post_id);
    },

    is_listen_later() {
      return self.selected_filter === 'listen_later';
    },

    sorted_posts() {
      return sort_discover_posts(self.posts);
    },

    visible_did_hydrate() {
      if (self.selected_filter === 'listen_later') {
        return self.listen_later_did_hydrate;
      } else {
        return self.did_hydrate;
      }
    },

    visible_is_loading() {
      if (self.selected_filter === 'listen_later') {
        return self.listen_later_is_loading;
      } else {
        return self.is_loading;
      }
    },

    visible_is_loading_more() {
      if (self.selected_filter === 'listen_later') {
        return self.listen_later_is_loading_more;
      } else {
        return self.is_loading_more;
      }
    },

    visible_posts() {
      if (self.selected_filter === 'listen_later') {
        return self.listen_later_posts.slice();
      } else {
        return sort_discover_posts(self.posts);
      }
    },
  }))
  .create();

export default Discover;
