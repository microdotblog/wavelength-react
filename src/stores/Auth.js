import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { Linking } from 'react-native';
import { flow, types } from 'mobx-state-tree';

import {
  build_micro_blog_auth_url,
  exchange_micro_blog_code,
  extract_legacy_wavelength_token,
  extract_micro_blog_callback_params,
  get_micro_blog_redirect_uri,
  is_legacy_wavelength_token_url,
  is_micro_blog_callback_url,
  normalize_micro_blog_session,
  verify_micro_blog_token,
} from '../api/MicroBlogAuth';
import Tokens from './Tokens';

async function create_oauth_state() {
  const state_bytes = await Crypto.getRandomBytesAsync(16);
  return Array.from(state_bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

function resolve_token_sign_in_error_message(error) {
  if (error?.status === 401 || error?.status === 403) {
    return 'That Micro.blog token is not valid. Please try again.';
  }

  return 'We could not sign you in with that token. Please try again.';
}

function resolve_verified_session_token(token = '', verify_payload = null) {
  const verified_token = `${verify_payload?.token || ''}`.trim();
  const fallback_token = `${token || ''}`.trim();

  return verified_token || fallback_token || null;
}

const Auth = types
  .model('Auth', {
    default_site: types.maybeNull(types.string),
    error_message: types.maybeNull(types.string),
    has_site: types.maybeNull(types.boolean),
    is_hydrating: types.optional(types.boolean, false),
    is_signing_in: types.optional(types.boolean, false),
    loading_phase: types.optional(types.string, 'idle'),
    me: types.maybeNull(types.string),
    profile_name: types.maybeNull(types.string),
    profile_photo: types.maybeNull(types.string),
    profile_url: types.maybeNull(types.string),
    token_scope: types.maybeNull(types.string),
    username: types.maybeNull(types.string),
  })
  .actions(self => ({
    clear_error() {
      self.error_message = null;
    },

    set_error(message = null) {
      self.error_message = message;
    },

    set_loading_phase(phase = 'idle') {
      const trimmed_phase = `${phase || ''}`.trim();

      if (trimmed_phase === 'connecting' || trimmed_phase === 'verifying') {
        self.loading_phase = trimmed_phase;
      } else {
        self.loading_phase = 'idle';
      }
    },

    clear_session_data() {
      self.default_site = null;
      self.has_site = null;
      self.me = null;
      self.profile_name = null;
      self.profile_photo = null;
      self.profile_url = null;
      self.token_scope = null;
      self.username = null;
    },

    apply_session_payloads(token_payload = null, verify_payload = null) {
      const next_session = normalize_micro_blog_session(token_payload, verify_payload);
      self.default_site = next_session.default_site;
      self.has_site = next_session.has_site;
      self.me = next_session.me;
      self.profile_name = next_session.profile_name;
      self.profile_photo = next_session.profile_photo;
      self.profile_url = next_session.profile_url;
      self.token_scope = next_session.token_scope;
      self.username = next_session.username;
    },

    hydrate: flow(function* () {
      if (self.is_hydrating) {
        return;
      }

      self.is_hydrating = true;
      self.clear_error();

      try {
        yield Tokens.hydrate();

        const initial_url = yield Linking.getInitialURL();
        if (initial_url && (yield self.handle_open_url(initial_url))) {
          return;
        }

        const stored_token = Tokens.get_user_token();
        if (!stored_token) {
          self.clear_session_data();
          return;
        }

        try {
          self.set_loading_phase('verifying');
          const verify_payload = yield verify_micro_blog_token(stored_token);
          const verified_token = resolve_verified_session_token(stored_token, verify_payload);

          if (verified_token && verified_token !== stored_token) {
            yield Tokens.set_user_token(verified_token);
          }

          self.apply_session_payloads(null, verify_payload);
        } catch (error) {
          if (error?.status === 401 || error?.status === 403) {
            yield self.clear_invalid_session('Your Micro.blog session expired. Please sign in again.');
          }
        }
      } finally {
        self.is_hydrating = false;
        self.set_loading_phase();
      }
    }),

    handle_open_url: flow(function* (raw_url = '') {
      if (is_legacy_wavelength_token_url(raw_url)) {
        const callback_token = extract_legacy_wavelength_token(raw_url);
        yield Tokens.clear_pending_oauth_state();
        return yield self.sign_in_with_token(callback_token, {
          allow_while_hydrating: true,
        });
      }

      if (!is_micro_blog_callback_url(raw_url)) {
        return false;
      }

      if (!Tokens.has_pending_oauth_state()) {
        return false;
      }

      return yield self.complete_sign_in_callback(raw_url);
    }),

    sign_in_with_micro_blog: flow(function* () {
      if (self.is_loading()) {
        return false;
      }

      self.clear_error();
      self.is_signing_in = true;
      self.set_loading_phase('connecting');

      try {
        yield Tokens.hydrate();

        const oauth_state = yield create_oauth_state();
        if (!oauth_state) {
          self.set_error('We could not prepare Micro.blog sign in. Please try again.');
          return false;
        }

        yield Tokens.set_pending_oauth_state(oauth_state);

        const redirect_uri = get_micro_blog_redirect_uri();
        const auth_url = build_micro_blog_auth_url({
          redirect_uri,
          state: oauth_state,
        });
        const auth_result = yield WebBrowser.openAuthSessionAsync(auth_url, redirect_uri);

        if (auth_result?.type === 'success' && auth_result?.url) {
          const did_handle_callback = yield self.handle_open_url(auth_result.url);

          if (did_handle_callback) {
            return true;
          }

          yield Tokens.clear_pending_oauth_state();
          self.set_error('Micro.blog sign in did not complete. Please try again.');
          return false;
        }

        yield Tokens.clear_pending_oauth_state();

        if (auth_result?.type === 'cancel' || auth_result?.type === 'dismiss') {
          self.clear_error();
        } else {
          self.set_error('Micro.blog sign in did not complete. Please try again.');
        }

        return false;
      } catch (error) {
        yield Tokens.clear_pending_oauth_state();
        self.set_error('We could not open Micro.blog sign in. Please try again.');
        return false;
      } finally {
        self.finish_sign_in();
      }
    }),

    sign_in_with_token: flow(function* (token = '', options = {}) {
      if (self.is_loading() && options.allow_while_hydrating !== true) {
        return false;
      }

      const trimmed_token = `${token || ''}`.trim();
      self.clear_error();

      if (!trimmed_token) {
        self.set_error('Enter a Micro.blog token to sign in.');
        return false;
      }

      self.is_signing_in = true;
      self.set_loading_phase('verifying');

      try {
        yield Tokens.hydrate();

        const verify_payload = yield verify_micro_blog_token(trimmed_token);
        const verified_token = resolve_verified_session_token(trimmed_token, verify_payload);
        yield Tokens.set_user_token(verified_token);
        self.apply_session_payloads(null, verify_payload);
        self.clear_error();
        return true;
      } catch (error) {
        yield Tokens.clear_user_token();
        self.clear_session_data();
        self.set_error(resolve_token_sign_in_error_message(error));
        return false;
      } finally {
        self.finish_sign_in();
      }
    }),

    complete_sign_in_callback: flow(function* (raw_url = '') {
      self.set_loading_phase('verifying');

      const { code, state } = extract_micro_blog_callback_params(raw_url);
      const expected_state = Tokens.get_pending_oauth_state();

      yield Tokens.clear_pending_oauth_state();

      if (!code) {
        self.set_error('Micro.blog did not return an authorization code. Please try again.');
        return false;
      }

      if (!state || !expected_state || state !== expected_state) {
        self.set_error('Micro.blog sign in could not be verified. Please try again.');
        return false;
      }

      try {
        const token_payload = yield exchange_micro_blog_code({ code });
        const access_token = `${token_payload?.access_token || ''}`.trim();

        if (!access_token) {
          throw new Error('Micro.blog did not return an access token.');
        }

        yield Tokens.set_user_token(access_token);
        self.apply_session_payloads(token_payload, null);

        try {
          const verify_payload = yield verify_micro_blog_token(access_token);
          const verified_token = resolve_verified_session_token(access_token, verify_payload);

          if (verified_token && verified_token !== access_token) {
            yield Tokens.set_user_token(verified_token);
          }

          self.apply_session_payloads(token_payload, verify_payload);
        } catch (error) {
          if (error?.status === 401 || error?.status === 403) {
            yield self.clear_invalid_session('Your Micro.blog session expired. Please sign in again.');
            return false;
          }
        }

        self.clear_error();
        return true;
      } catch (error) {
        yield Tokens.clear_user_token();
        self.clear_session_data();
        self.set_error('We could not finish signing you in. Please try again.');
        return false;
      } finally {
        if (!self.is_hydrating) {
          self.set_loading_phase();
        }
      }
    }),

    clear_invalid_session: flow(function* (message = null) {
      yield Tokens.clear_all();
      self.clear_session_data();
      self.set_error(message);
      self.set_loading_phase();
    }),

    sign_out: flow(function* () {
      yield Tokens.clear_all();
      self.clear_session_data();
      self.clear_error();
      self.set_loading_phase();
    }),

    finish_sign_in() {
      self.is_signing_in = false;
      self.set_loading_phase();
    },
  }))
  .views(self => ({
    is_loading() {
      return self.is_hydrating || self.is_signing_in;
    },

    is_signed_in() {
      return Tokens.has_user_token();
    },

    can_handle_open_url(raw_url = '') {
      return is_legacy_wavelength_token_url(raw_url) || is_micro_blog_callback_url(raw_url);
    },

    current_profile() {
      return {
        default_site: self.default_site || '',
        has_site: self.has_site,
        name: self.profile_name || self.username || '',
        photo: self.profile_photo || '',
        url: self.profile_url || self.me || '',
        username: self.username || '',
      };
    },
  }))
  .create();

export default Auth;
