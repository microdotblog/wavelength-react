jest.mock('../Auth', () => ({
  __esModule: true,
  default: {
    default_site: 'https://test.micro.blog',
  },
}));

jest.mock('../Posts', () => ({
  __esModule: true,
  default: {
    refresh: jest.fn(async () => null),
  },
}));

jest.mock('../Tokens', () => ({
  __esModule: true,
  default: {
    get_user_token: jest.fn(() => 'token'),
  },
}));

jest.mock('../../api/Micropub', () => ({
  delete_micropub_post: jest.fn(async () => true),
}));

jest.mock('../../lib/EpisodeStorage', () => ({
  append_clip_to_episode: jest.fn(),
  clear_episode_publish_link: jest.fn(async () => ({
    clip_meta: [],
    clips: ['segment.m4a'],
    created_at: '2026-06-01T12:00:00Z',
    duration_seconds: 60,
    folder_uri: 'file:///episodes/ep-1/',
    id: 'episode-1',
    post_id: null,
    post_url: null,
    published_at: null,
    title: 'Morning microcast',
    waveform: [],
  })),
  delete_legacy_episode: jest.fn(async () => null),
  delete_episode: jest.fn(async () => null),
  duplicate_episode: jest.fn(),
  get_episode_clip_uri: jest.fn((episode, clip_name) => `${episode.folder_uri}${clip_name}`),
  get_exported_clip_uri: jest.fn(episode => `${episode.folder_uri}exported.m4a`),
  list_legacy_episodes: jest.fn(async () => []),
  list_episodes: jest.fn(async () => []),
  mark_episode_published: jest.fn(),
  read_episode: jest.fn(),
  read_migrated_episode: jest.fn(async () => null),
  replace_episode_clips: jest.fn(async () => ({
    clip_meta: [{ duration_seconds: 60, name: 'segment-2.m4a', waveform: [0.1] }],
    clips: ['segment-2.m4a', 'segment.m4a'],
    created_at: '2026-06-01T12:00:00Z',
    duration_seconds: 60,
    folder_uri: 'file:///episodes/ep-1/',
    id: 'episode-1',
    post_id: '12345',
    post_url: 'https://example.micro.blog/post/1',
    published_at: '2026-06-02T12:00:00Z',
    title: 'Morning microcast',
    waveform: [0.1],
  })),
  save_episode_from_recording: jest.fn(),
  save_migrated_episode: jest.fn(),
  update_episode_title: jest.fn(),
}));

jest.mock('../../lib/episode_audio', () => ({
  delete_audio_file: jest.fn(),
  export_episode_mp3: jest.fn(async () => 'file:///episodes/ep-1/exported.mp3'),
  merge_episode_clips: jest.fn(async () => 'file:///episodes/ep-1/exported.m4a'),
  normalize_imported_audio: jest.fn(),
}));

const { applySnapshot, getType } = require('mobx-state-tree');
const { delete_micropub_post } = require('../../api/Micropub');
const {
  append_clip_to_episode,
  clear_episode_publish_link,
  delete_legacy_episode,
  delete_episode: remove_episode_from_storage,
  list_legacy_episodes,
  list_episodes,
  read_migrated_episode,
  replace_episode_clips,
  save_migrated_episode,
} = require('../../lib/EpisodeStorage');
const {
  delete_audio_file,
  export_episode_mp3,
  merge_episode_clips,
  normalize_imported_audio,
} = require('../../lib/episode_audio');
const Posts = require('../Posts').default;
const Tokens = require('../Tokens').default;
const Episodes = require('../Episodes').default;

const EPISODE_BY_ID = {
  clip_meta: [{ duration_seconds: 60, name: 'segment.m4a', size_bytes: 40_000_000, waveform: [0.1, 0.5] }],
  clips: ['segment.m4a'],
  created_at: '2026-06-01T12:00:00Z',
  duration_seconds: 60,
  folder_uri: 'file:///episodes/ep-1/',
  id: 'episode-1',
  post_id: '12345',
  post_url: 'https://example.micro.blog/post/1',
  published_at: '2026-06-02T12:00:00Z',
  title: 'Morning microcast',
  waveform: [0.1, 0.5],
};

const EPISODE_BY_URL = {
  clip_meta: [{ duration_seconds: 30, name: 'segment.m4a', size_bytes: 80_000_000, waveform: [0.2] }],
  clips: ['segment.m4a'],
  created_at: '2026-06-01T13:00:00Z',
  duration_seconds: 30,
  folder_uri: 'file:///episodes/ep-2/',
  id: 'episode-2',
  post_id: null,
  post_url: 'https://example.micro.blog/post/2',
  published_at: null,
  title: 'Afternoon microcast',
  waveform: [0.2],
};

describe('Episodes store', () => {
  beforeEach(() => {
    applySnapshot(Episodes, {
      episodes: [EPISODE_BY_ID, EPISODE_BY_URL],
    });

    for (const episode_id of Object.keys(Episodes.export_fingerprints)) {
      delete Episodes.export_fingerprints[episode_id];
    }

    delete_micropub_post.mockClear();
    Posts.refresh.mockClear();
    append_clip_to_episode.mockClear();
    remove_episode_from_storage.mockClear();
    clear_episode_publish_link.mockClear();
    delete_legacy_episode.mockClear();
    delete_audio_file.mockClear();
    export_episode_mp3.mockClear();
    list_legacy_episodes.mockClear();
    list_episodes.mockClear();
    merge_episode_clips.mockClear();
    normalize_imported_audio.mockClear();
    read_migrated_episode.mockClear();
    save_migrated_episode.mockClear();
    list_legacy_episodes.mockResolvedValue([]);
    list_episodes.mockResolvedValue([]);
    read_migrated_episode.mockResolvedValue(null);
    Tokens.get_user_token.mockReturnValue('token');
  });

  describe('legacy migration', () => {
    const legacy_episode = {
      clips: [{ name: 'recording.caf', uri: 'file:///documents/recording.caf' }],
      created_at: '2024-03-13T18:34:56.000Z',
      id: '2024-03-13 12:34:56',
      title: 'Legacy recording',
    };
    const converted_clip = {
      duration_seconds: 60,
      uri: 'file:///tmp/recording.m4a',
      waveform: [0.1, 0.5],
    };
    const migrated_episode = {
      ...EPISODE_BY_ID,
      folder_uri: 'file:///episodes/legacy-2024-03-13-12-34-56/',
      id: 'legacy-2024-03-13-12-34-56',
      post_id: null,
      post_url: null,
      published_at: null,
      title: 'Legacy recording',
    };
    let legacy_store;

    beforeEach(() => {
      legacy_store = getType(Episodes).create();
      jest.useFakeTimers({ doNotFake: ['queueMicrotask'] });
      jest.spyOn(console, 'warn').mockImplementation(() => {});
      list_episodes.mockResolvedValue([EPISODE_BY_ID]);
      list_legacy_episodes.mockResolvedValue([legacy_episode]);
      normalize_imported_audio.mockResolvedValue(converted_clip);
      save_migrated_episode.mockResolvedValue(migrated_episode);
    });

    afterEach(() => {
      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    test('converts legacy clips before deleting the old episode folder', async () => {
      let finish_conversion;
      const conversion = new Promise(resolve => {
        finish_conversion = resolve;
      });
      list_legacy_episodes.mockResolvedValueOnce([
        legacy_episode,
        {
          clips: [{ name: 'missing.caf', uri: 'file:///documents/missing.caf' }],
          created_at: '2024-03-14T18:34:56.000Z',
          id: '2024-03-14 12:34:56',
          title: 'Failed recording',
        },
      ]);
      normalize_imported_audio
        .mockReturnValueOnce(conversion)
        .mockRejectedValueOnce(new Error('Conversion failed.'));
      const refresh = legacy_store.refresh();

      await jest.advanceTimersByTimeAsync(0);

      expect(legacy_store.is_upgrading_legacy).toBe(true);
      expect(legacy_store.did_hydrate).toBe(true);
      expect(legacy_store.get_episode('episode-1')?.title).toBe('Morning microcast');

      finish_conversion(converted_clip);
      await refresh;

      expect(read_migrated_episode).toHaveBeenCalledWith(
        '2024-03-13 12:34:56',
        1,
      );
      expect(save_migrated_episode).toHaveBeenCalledWith(
        expect.objectContaining({ id: '2024-03-13 12:34:56' }),
        [{
          duration_seconds: 60,
          uri: 'file:///tmp/recording.m4a',
          waveform: [0.1, 0.5],
        }],
      );
      expect(delete_legacy_episode).toHaveBeenCalledWith('2024-03-13 12:34:56');
      expect(delete_legacy_episode).not.toHaveBeenCalledWith('2024-03-14 12:34:56');
      expect(save_migrated_episode.mock.invocationCallOrder[0])
        .toBeLessThan(delete_legacy_episode.mock.invocationCallOrder[0]);
      expect(delete_audio_file).toHaveBeenCalledWith('file:///tmp/recording.m4a');
      expect(legacy_store.is_upgrading_legacy).toBe(false);
      expect(legacy_store.get_episode(migrated_episode.id)?.title).toBe('Legacy recording');
      expect(legacy_store.get_episode('episode-1')?.title).toBe('Morning microcast');
      expect(console.warn).toHaveBeenCalledWith(
        'Could not upgrade legacy recording:',
        '2024-03-14 12:34:56',
        expect.any(Error),
      );
      expect(jest.getTimerCount()).toBe(0);
    });

    test('loads existing recordings even when the legacy scan fails', async () => {
      list_legacy_episodes.mockRejectedValueOnce(new Error('Could not read old folders.'));

      await legacy_store.refresh();

      expect(legacy_store.get_episode('episode-1')?.title).toBe('Morning microcast');
      expect(legacy_store.did_hydrate).toBe(true);
      expect(legacy_store.is_loading).toBe(false);
      expect(legacy_store.is_upgrading_legacy).toBe(false);
      expect(delete_legacy_episode).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalledWith(
        'Could not upgrade legacy recordings:',
        expect.any(Error),
      );
    });

    test.each([
      ['finding old recordings', list_legacy_episodes],
      ['checking an existing migration', read_migrated_episode],
      ['converting audio', normalize_imported_audio],
      ['saving converted audio', save_migrated_episode],
    ])('continues after 30 seconds when %s hangs', async (_, stalled_operation) => {
      stalled_operation.mockReturnValueOnce(new Promise(() => {}));

      const refresh = legacy_store.refresh();

      await jest.advanceTimersByTimeAsync(30_000);
      await refresh;

      expect(legacy_store.get_episode('episode-1')?.title).toBe('Morning microcast');
      expect(legacy_store.did_hydrate).toBe(true);
      expect(legacy_store.is_loading).toBe(false);
      expect(legacy_store.is_upgrading_legacy).toBe(false);
      expect(delete_legacy_episode).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalledWith('Legacy recording upgrade timed out.');
      expect(jest.getTimerCount()).toBe(0);

      await legacy_store.refresh();

      expect(list_episodes).toHaveBeenCalledTimes(2);
      expect(list_legacy_episodes).toHaveBeenCalledTimes(1);
    });

    test('Continue stops waiting and discards a late conversion without deleting originals', async () => {
      let finish_conversion;
      normalize_imported_audio.mockReturnValueOnce(new Promise(resolve => {
        finish_conversion = resolve;
      }));
      list_legacy_episodes.mockResolvedValueOnce([
        {
          ...legacy_episode,
          clips: [
            ...legacy_episode.clips,
            { name: 'second.caf', uri: 'file:///documents/second.caf' },
          ],
        },
        { ...legacy_episode, id: '2024-03-14 12:34:56' },
      ]);

      const refresh = legacy_store.refresh();

      await jest.advanceTimersByTimeAsync(0);
      legacy_store.continue_without_legacy_upgrade();

      expect(legacy_store.is_upgrading_legacy).toBe(false);
      await refresh;
      expect(legacy_store.is_loading).toBe(false);

      legacy_store.apply_episode_snapshot(EPISODE_BY_URL);
      finish_conversion(converted_clip);
      await jest.advanceTimersByTimeAsync(0);

      expect(normalize_imported_audio).toHaveBeenCalledTimes(1);
      expect(read_migrated_episode).toHaveBeenCalledTimes(1);
      expect(save_migrated_episode).not.toHaveBeenCalled();
      expect(delete_legacy_episode).not.toHaveBeenCalled();
      expect(delete_audio_file).toHaveBeenCalledWith(converted_clip.uri);
      expect(legacy_store.get_episode('episode-2')?.title).toBe('Afternoon microcast');
      expect(legacy_store.get_episode(migrated_episode.id)).toBeNull();
      expect(jest.getTimerCount()).toBe(0);
    });

    test('a save finishing after timeout keeps the original and does not change the loaded list', async () => {
      let finish_save;
      save_migrated_episode.mockReturnValueOnce(new Promise(resolve => {
        finish_save = resolve;
      }));

      const refresh = legacy_store.refresh();

      await jest.advanceTimersByTimeAsync(30_000);
      await refresh;

      finish_save(migrated_episode);
      await jest.advanceTimersByTimeAsync(0);

      expect(delete_legacy_episode).not.toHaveBeenCalled();
      expect(legacy_store.get_episode(migrated_episode.id)).toBeNull();
      expect(legacy_store.get_episode('episode-1')?.title).toBe('Morning microcast');
      expect(legacy_store.is_upgrading_legacy).toBe(false);
    });
  });

  describe('get_episode_for_post', () => {
    test('finds an episode by post id', () => {
      const episode = Episodes.get_episode_for_post({ post_id: '12345' });

      expect(episode?.id).toBe('episode-1');
    });

    test('falls back to post url when post id does not match', () => {
      const episode = Episodes.get_episode_for_post({
        post_id: 'missing',
        post_url: 'https://example.micro.blog/post/2',
      });

      expect(episode?.id).toBe('episode-2');
    });

    test('prefers post id over post url', () => {
      const episode = Episodes.get_episode_for_post({
        post_id: '12345',
        post_url: 'https://example.micro.blog/post/2',
      });

      expect(episode?.id).toBe('episode-1');
    });

    test('returns null when no episode matches', () => {
      expect(Episodes.get_episode_for_post({
        post_id: 'missing',
        post_url: 'https://example.micro.blog/post/missing',
      })).toBeNull();
    });
  });

  describe('is_published', () => {
    test('returns true when post id or post url is present', () => {
      expect(Episodes.get_episode('episode-1').is_published()).toBe(true);
      expect(Episodes.get_episode('episode-2').is_published()).toBe(true);
    });
  });

  describe('audio size views', () => {
    test('sums clip sizes and formats the total', () => {
      const episode = Episodes.get_episode('episode-1');

      expect(episode.total_audio_size_bytes()).toBe(40_000_000);
      expect(episode.formatted_audio_size()).toBe('40 MB');
      expect(episode.is_over_upload_limit()).toBe(false);
    });

    test('flags episodes over the upload limit', () => {
      const episode = Episodes.get_episode('episode-2');

      expect(episode.total_audio_size_bytes()).toBe(80_000_000);
      expect(episode.formatted_audio_size()).toBe('80 MB');
      expect(episode.is_over_upload_limit()).toBe(true);
    });
  });

  describe('delete_episode', () => {
    test('deletes the linked micropub post when delete_post is true', async () => {
      await Episodes.delete_episode('episode-1', { delete_post: true });

      expect(delete_micropub_post).toHaveBeenCalledWith({
        destination: 'https://test.micro.blog',
        post_url: 'https://example.micro.blog/post/1',
        token: 'token',
      });
      expect(Posts.refresh).toHaveBeenCalled();
      expect(remove_episode_from_storage).toHaveBeenCalledWith('episode-1');
      expect(Episodes.episodes).toHaveLength(1);
      expect(Episodes.export_fingerprints['episode-1']).toBeUndefined();
    });

    test('skips micropub delete when delete_post is false', async () => {
      await Episodes.delete_episode('episode-1', { delete_post: false });

      expect(delete_micropub_post).not.toHaveBeenCalled();
      expect(Posts.refresh).not.toHaveBeenCalled();
      expect(Episodes.episodes).toHaveLength(1);
    });

    test('throws when delete_post is true but the user is not signed in', async () => {
      Tokens.get_user_token.mockReturnValueOnce('');

      await expect(
        Episodes.delete_episode('episode-1', { delete_post: true }),
      ).rejects.toThrow('You need to be signed in to Micro.blog to delete a post.');
    });
  });

  describe('clear_publish_link', () => {
    test('clears publish metadata on the episode snapshot', async () => {
      await Episodes.clear_publish_link('episode-1');

      expect(clear_episode_publish_link).toHaveBeenCalledWith('episode-1');
      expect(Episodes.get_episode('episode-1').post_id).toBeNull();
      expect(Episodes.get_episode('episode-1').post_url).toBeNull();
    });
  });

  describe('import_clip_to_episode', () => {
    test('normalizes the selected file and appends the result', async () => {
      normalize_imported_audio.mockResolvedValue({
        duration_seconds: 12,
        uri: 'file:///tmp/imported.aac',
        waveform: [0.2, 0.8],
      });
      append_clip_to_episode.mockResolvedValue({
        ...EPISODE_BY_ID,
        clip_meta: [
          ...EPISODE_BY_ID.clip_meta,
          {
            duration_seconds: 12,
            name: 'segment-2.aac',
            size_bytes: 1_500_000,
            waveform: [0.2, 0.8],
          },
        ],
        clips: ['segment.m4a', 'segment-2.aac'],
        duration_seconds: 72,
      });

      await expect(
        Episodes.import_clip_to_episode('episode-1', 'file:///tmp/source.mp3'),
      ).resolves.toBe('episode-1');

      expect(normalize_imported_audio).toHaveBeenCalledWith('file:///tmp/source.mp3');
      expect(append_clip_to_episode).toHaveBeenCalledWith(
        'episode-1',
        'file:///tmp/imported.aac',
        12,
        [0.2, 0.8],
      );
      expect(Episodes.get_episode('episode-1').clips).toEqual([
        'segment.m4a',
        'segment-2.aac',
      ]);
      expect(delete_audio_file).toHaveBeenCalledWith('file:///tmp/imported.aac');
    });

    test('removes the converted temporary file when storage fails', async () => {
      normalize_imported_audio.mockResolvedValue({
        duration_seconds: 12,
        uri: 'file:///tmp/imported.aac',
        waveform: [0.2],
      });
      append_clip_to_episode.mockRejectedValue(new Error('Storage failed.'));

      await expect(
        Episodes.import_clip_to_episode('episode-1', 'file:///tmp/source.mp3'),
      ).rejects.toThrow('Storage failed.');

      expect(delete_audio_file).toHaveBeenCalledWith('file:///tmp/imported.aac');
    });
  });

  describe('export_merged_audio', () => {
    test('returns empty string when the episode has no clips', async () => {
      applySnapshot(Episodes, {
        episodes: [{
          ...EPISODE_BY_ID,
          clips: [],
        }],
      });

      await expect(Episodes.export_merged_audio('episode-1')).resolves.toBe('');
      expect(merge_episode_clips).not.toHaveBeenCalled();
    });

    test('merges clips on first export and reuses cached export when clip order is unchanged', async () => {
      const first_uri = await Episodes.export_merged_audio('episode-1');
      const second_uri = await Episodes.export_merged_audio('episode-1');

      expect(first_uri).toBe('file:///episodes/ep-1/exported.m4a');
      expect(second_uri).toBe('file:///episodes/ep-1/exported.m4a');
      expect(merge_episode_clips).toHaveBeenCalledTimes(1);
    });

    test('re-merges when clip order changes', async () => {
      await Episodes.export_merged_audio('episode-1');
      await Episodes.update_episode_clips('episode-1', []);
      await Episodes.export_merged_audio('episode-1');

      expect(replace_episode_clips).toHaveBeenCalledWith('episode-1', []);
      expect(merge_episode_clips).toHaveBeenCalledTimes(2);
    });
  });

  describe('export_published_audio', () => {
    test('converts the merged AAC export to MP3', async () => {
      const exported_uri = await Episodes.export_published_audio('episode-1');

      expect(exported_uri).toBe('file:///episodes/ep-1/exported.mp3');
      expect(merge_episode_clips).toHaveBeenCalledWith(expect.objectContaining({
        id: 'episode-1',
      }));
      expect(export_episode_mp3).toHaveBeenCalledWith(
        'file:///episodes/ep-1/exported.m4a',
      );
    });

    test('returns empty string when MP3 encoding fails', async () => {
      export_episode_mp3.mockRejectedValueOnce(new Error('Encoding failed.'));

      await expect(Episodes.export_published_audio('episode-1')).resolves.toBe('');
    });
  });
});
