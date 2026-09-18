import { applySnapshot, flow, types } from 'mobx-state-tree';

import { get_episode_clip_uri } from '../lib/EpisodeStorage';
import {
  delete_audio_file,
  merge_episode_clips,
  normalize_imported_audio,
} from '../lib/episode_audio';
import {
  build_upload_size_limit_message,
  format_file_size,
  is_over_upload_limit,
  sanitize_size_bytes,
} from '../lib/episode_upload_size';
import {
  append_clip_to_narration,
  copy_narration_take,
  create_narration_draft,
  delete_narration_draft,
  download_remote_audio,
  replace_narration_clips,
} from '../lib/narration_storage';

const EMPTY_DRAFT = {
  clip_meta: [],
  clips: [],
  created_at: null,
  duration_seconds: 0,
  folder_uri: '',
  post_uid: null,
  waveform: [],
};

const ClipMeta = types.model('NarrationClipMeta', {
  duration_seconds: types.optional(types.number, 0),
  name: types.string,
  size_bytes: types.optional(types.number, 0),
  waveform: types.optional(types.array(types.number), []),
});

const NarrationDraft = types
  .model('NarrationDraft', {
    clip_meta: types.optional(types.array(ClipMeta), []),
    clips: types.optional(types.array(types.string), []),
    created_at: types.maybeNull(types.string),
    duration_seconds: types.optional(types.number, 0),
    folder_uri: types.optional(types.string, ''),
    post_uid: types.maybeNull(types.string),
    waveform: types.optional(types.array(types.number), []),
  })
  .volatile(() => ({
    is_dirty: false,
    is_loading: false,
    is_saving: false,
    open_generation: 0,
    pending_take: null,
  }))
  .views(self => ({
    clip_uri(clip_name) {
      return get_episode_clip_uri(self, clip_name);
    },

    playback_clips() {
      return self.clip_meta.map(clip => ({
        duration_seconds: clip.duration_seconds,
        name: clip.name,
        uri: get_episode_clip_uri(self, clip.name),
      }));
    },

    total_audio_size_bytes() {
      return self.clip_meta.reduce(
        (sum, clip) => sum + sanitize_size_bytes(clip.size_bytes),
        0,
      );
    },

    formatted_audio_size() {
      return format_file_size(self.total_audio_size_bytes());
    },

    is_over_upload_limit() {
      return is_over_upload_limit(self.total_audio_size_bytes());
    },

    is_open_for(post_uid = '') {
      const trimmed_uid = `${post_uid || ''}`.trim();

      return trimmed_uid.length > 0 && self.post_uid === trimmed_uid;
    },
  }))
  .actions(self => ({
    apply_draft_snapshot(snapshot) {
      applySnapshot(self, {
        clip_meta: snapshot.clip_meta || [],
        clips: snapshot.clips || [],
        created_at: snapshot.created_at || null,
        duration_seconds: snapshot.duration_seconds || 0,
        folder_uri: snapshot.folder_uri || '',
        post_uid: snapshot.post_uid || null,
        waveform: snapshot.waveform || [],
      });
    },

    reset_draft() {
      applySnapshot(self, EMPTY_DRAFT);
      self.is_dirty = false;
      self.is_loading = false;
      self.is_saving = false;
    },

    consume_pending_take() {
      const take = self.pending_take;
      self.pending_take = null;

      return take;
    },

    discard: flow(function* () {
      const post_uid = self.post_uid;
      self.open_generation += 1;
      self.reset_draft();

      if (post_uid) {
        delete_narration_draft(post_uid);
      }

      yield Promise.resolve();
    }),

    open: flow(function* (post_uid = '', audio_url = '') {
      const trimmed_uid = `${post_uid || ''}`.trim();
      const trimmed_url = `${audio_url || ''}`.trim();

      if (!trimmed_uid) {
        throw new Error('This post is no longer available.');
      }

      if (!trimmed_url) {
        throw new Error('This post has no narration to edit.');
      }

      if (self.post_uid === trimmed_uid && (self.clips.length > 0 || self.is_loading)) {
        return self.post_uid;
      }

      if (self.post_uid && self.post_uid !== trimmed_uid) {
        yield self.discard();
      }

      const generation = self.open_generation + 1;
      self.open_generation = generation;
      self.post_uid = trimmed_uid;
      self.is_loading = true;
      self.is_dirty = false;

      let normalized_uri = '';

      try {
        const source_uri = yield download_remote_audio(trimmed_url);
        const normalized = yield normalize_imported_audio(source_uri);
        normalized_uri = normalized.uri;

        if (/^https?:/i.test(trimmed_url) && source_uri !== normalized_uri) {
          delete_audio_file(source_uri);
        }

        if (self.open_generation !== generation) {
          delete_audio_file(normalized_uri);
          return null;
        }

        const snapshot = yield create_narration_draft({
          duration_seconds: normalized.duration_seconds,
          post_uid: trimmed_uid,
          source_uri: normalized.uri,
          waveform: normalized.waveform,
        });

        if (self.open_generation !== generation) {
          delete_narration_draft(trimmed_uid);
          return null;
        }

        self.apply_draft_snapshot(snapshot);
        self.is_dirty = false;

        return self.post_uid;
      } catch (error) {
        if (normalized_uri) {
          delete_audio_file(normalized_uri);
        }

        if (self.open_generation === generation) {
          yield self.discard();
        }

        throw error;
      } finally {
        if (self.open_generation === generation) {
          self.is_loading = false;
        }
      }
    }),

    append_clip: flow(function* (recording_uri = '', duration_seconds = 0, waveform = []) {
      const snapshot = yield append_clip_to_narration(
        self.post_uid,
        recording_uri,
        duration_seconds,
        waveform,
      );
      self.apply_draft_snapshot(snapshot);
      self.is_dirty = true;

      return snapshot.post_uid;
    }),

    import_clip: flow(function* (source_uri = '') {
      let normalized_uri = '';

      try {
        const normalized = yield normalize_imported_audio(source_uri);
        normalized_uri = normalized.uri;

        const snapshot = yield append_clip_to_narration(
          self.post_uid,
          normalized.uri,
          normalized.duration_seconds,
          normalized.waveform,
        );
        self.apply_draft_snapshot(snapshot);
        self.is_dirty = true;

        return snapshot.post_uid;
      } finally {
        if (normalized_uri) {
          delete_audio_file(normalized_uri);
        }
      }
    }),

    update_clips: flow(function* (clip_meta = []) {
      const next_clips = Array.isArray(clip_meta)
        ? clip_meta.filter(clip => `${clip?.name || ''}`.trim().length > 0)
        : [];

      if (next_clips.length === 0) {
        throw new Error('Narration needs at least one segment.');
      }

      const snapshot = yield replace_narration_clips(self.post_uid, next_clips);
      self.apply_draft_snapshot(snapshot);
      self.is_dirty = true;

      return snapshot.post_uid;
    }),

    commit_local: flow(function* () {
      const post_uid = `${self.post_uid || ''}`.trim();

      if (!post_uid || self.clips.length === 0) {
        throw new Error('This narration has no audio to save.');
      }

      if (self.is_over_upload_limit()) {
        throw new Error(build_upload_size_limit_message(self.total_audio_size_bytes(), 'narration'));
      }

      self.is_saving = true;

      try {
        const merged_uri = yield merge_episode_clips({
          clips: self.clips.slice(),
          folder_uri: self.folder_uri,
        });

        if (!merged_uri) {
          throw new Error('That narration could not be prepared.');
        }

        const take_uri = yield copy_narration_take(merged_uri);
        const result = {
          duration_seconds: self.duration_seconds,
          uri: take_uri,
          waveform: self.waveform.slice(),
        };

        self.pending_take = result;
        yield self.discard();

        return result;
      } finally {
        self.is_saving = false;
      }
    }),
  }))
  .create(EMPTY_DRAFT);

export default NarrationDraft;
