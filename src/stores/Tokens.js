import * as SecureStore from 'expo-secure-store';
import { applySnapshot, flow, types } from 'mobx-state-tree';

const TOKENS_STORAGE_KEY = 'WavelengthTokens';

const Tokens = types
  .model('Tokens', {
    pending_oauth_state: types.maybeNull(types.string),
    user_token: types.maybeNull(types.string),
  })
  .volatile(() => ({
    did_hydrate: false,
  }))
  .actions(self => ({
    hydrate: flow(function* (force = false) {
      if (self.did_hydrate && !force) {
        return;
      }

      try {
        const data = yield SecureStore.getItemAsync(TOKENS_STORAGE_KEY);

        if (data) {
          applySnapshot(self, JSON.parse(data));
        } else {
          applySnapshot(self, {});
        }
      } catch (error) {
        applySnapshot(self, {});
      }

      self.did_hydrate = true;
    }),

    persist: flow(function* () {
      const snapshot = {
        pending_oauth_state: self.pending_oauth_state,
        user_token: self.user_token,
      };

      if (!snapshot.user_token && !snapshot.pending_oauth_state) {
        yield SecureStore.deleteItemAsync(TOKENS_STORAGE_KEY);
        return;
      }

      yield SecureStore.setItemAsync(TOKENS_STORAGE_KEY, JSON.stringify(snapshot));
    }),

    set_user_token: flow(function* (token = '') {
      const trimmed_token = `${token || ''}`.trim();
      self.user_token = trimmed_token || null;
      yield self.persist();
      return self.user_token;
    }),

    clear_user_token: flow(function* () {
      self.user_token = null;
      yield self.persist();
    }),

    set_pending_oauth_state: flow(function* (state = '') {
      const trimmed_state = `${state || ''}`.trim();
      self.pending_oauth_state = trimmed_state || null;
      yield self.persist();
      return self.pending_oauth_state;
    }),

    clear_pending_oauth_state: flow(function* () {
      self.pending_oauth_state = null;
      yield self.persist();
    }),

    clear_all: flow(function* () {
      applySnapshot(self, {});
      yield SecureStore.deleteItemAsync(TOKENS_STORAGE_KEY);
    }),
  }))
  .views(self => ({
    get_user_token() {
      return `${self.user_token || ''}`.trim();
    },

    has_user_token() {
      return this.get_user_token().length > 0;
    },

    get_pending_oauth_state() {
      return `${self.pending_oauth_state || ''}`.trim();
    },

    has_pending_oauth_state() {
      return this.get_pending_oauth_state().length > 0;
    },
  }))
  .create();

export default Tokens;
