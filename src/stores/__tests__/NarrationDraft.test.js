jest.mock('../../lib/EpisodeStorage', () => ({
  get_episode_clip_uri: jest.fn((draft, clip_name) => `${draft.folder_uri}${clip_name}`),
}));

jest.mock('../../lib/episode_audio', () => ({
  delete_audio_file: jest.fn(),
  merge_episode_clips: jest.fn(async () => 'file:///narrations/post-3/exported.m4a'),
  normalize_imported_audio: jest.fn(),
}));

jest.mock('../../lib/narration_storage', () => ({
  append_clip_to_narration: jest.fn(),
  copy_narration_take: jest.fn(),
  create_narration_draft: jest.fn(),
  delete_narration_draft: jest.fn(),
  download_remote_audio: jest.fn(),
  place_narration_clip_file: jest.fn(),
  replace_narration_clips: jest.fn(),
}));

const {
  delete_audio_file,
  merge_episode_clips,
  normalize_imported_audio,
} = require('../../lib/episode_audio');
const {
  append_clip_to_narration,
  copy_narration_take,
  create_narration_draft,
  delete_narration_draft,
  download_remote_audio,
  replace_narration_clips,
} = require('../../lib/narration_storage');
const NarrationDraft = require('../NarrationDraft').default;

const DRAFT_SNAPSHOT = {
  clip_meta: [
    {
      duration_seconds: 12,
      name: 'segment-1.m4a',
      size_bytes: 1200,
      waveform: [0.2, 0.4],
    },
  ],
  clips: ['segment-1.m4a'],
  created_at: '2026-09-14T12:00:00Z',
  duration_seconds: 12,
  folder_uri: 'file:///narrations/3/',
  post_uid: '3',
  waveform: [0.2, 0.4],
};

describe('NarrationDraft store', () => {
  beforeEach(async () => {
    await NarrationDraft.discard();
    NarrationDraft.consume_pending_take();
    download_remote_audio.mockReset();
    delete_audio_file.mockReset();
    normalize_imported_audio.mockReset();
    create_narration_draft.mockReset();
    append_clip_to_narration.mockReset();
    replace_narration_clips.mockReset();
    delete_narration_draft.mockReset();
    copy_narration_take.mockReset();
    merge_episode_clips.mockReset();
    merge_episode_clips.mockResolvedValue('file:///narrations/post-3/exported.m4a');
    copy_narration_take.mockResolvedValue('file:///cache/narration-take-1.m4a');
  });

  test('open downloads remote audio into a local working copy', async () => {
    download_remote_audio.mockResolvedValue('file:///cache/source.m4a');
    normalize_imported_audio.mockResolvedValue({
      duration_seconds: 12,
      uri: 'file:///tmp/normalized.m4a',
      waveform: [0.2, 0.4],
    });
    create_narration_draft.mockResolvedValue(DRAFT_SNAPSHOT);

    await NarrationDraft.open('3', 'https://cdn.example/read.m4a');

    expect(download_remote_audio).toHaveBeenCalledWith('https://cdn.example/read.m4a');
    expect(create_narration_draft).toHaveBeenCalledWith({
      duration_seconds: 12,
      post_uid: '3',
      source_uri: 'file:///tmp/normalized.m4a',
      waveform: [0.2, 0.4],
    });
    expect(NarrationDraft.post_uid).toBe('3');
    expect(NarrationDraft.clips.slice()).toEqual(['segment-1.m4a']);
    expect(NarrationDraft.is_dirty).toBe(false);
    expect(NarrationDraft.clip_uri('segment-1.m4a')).toBe('file:///narrations/3/segment-1.m4a');
  });

  test('open does not delete a local source outside the cache', async () => {
    download_remote_audio.mockResolvedValue('file:///recordings/keep.m4a');
    normalize_imported_audio.mockResolvedValue({
      duration_seconds: 12,
      uri: 'file:///tmp/normalized.m4a',
      waveform: [0.2],
    });
    create_narration_draft.mockResolvedValue(DRAFT_SNAPSHOT);

    await NarrationDraft.open('3', 'file:///recordings/keep.m4a');

    expect(delete_audio_file).not.toHaveBeenCalledWith('file:///recordings/keep.m4a');
  });

  test('open resumes an in-memory draft for the same post', async () => {
    download_remote_audio.mockResolvedValue('file:///cache/source.m4a');
    normalize_imported_audio.mockResolvedValue({
      duration_seconds: 12,
      uri: 'file:///tmp/normalized.m4a',
      waveform: [0.2],
    });
    create_narration_draft.mockResolvedValue(DRAFT_SNAPSHOT);

    await NarrationDraft.open('3', 'https://cdn.example/read.m4a');
    await NarrationDraft.open('3', 'https://cdn.example/read.m4a');

    expect(create_narration_draft).toHaveBeenCalledTimes(1);
  });

  test('append_clip marks the draft dirty', async () => {
    download_remote_audio.mockResolvedValue('file:///cache/source.m4a');
    normalize_imported_audio.mockResolvedValue({
      duration_seconds: 12,
      uri: 'file:///tmp/normalized.m4a',
      waveform: [0.2],
    });
    create_narration_draft.mockResolvedValue(DRAFT_SNAPSHOT);
    append_clip_to_narration.mockResolvedValue({
      ...DRAFT_SNAPSHOT,
      clip_meta: [
        ...DRAFT_SNAPSHOT.clip_meta,
        {
          duration_seconds: 4,
          name: 'segment-2.m4a',
          size_bytes: 400,
          waveform: [0.1],
        },
      ],
      clips: ['segment-1.m4a', 'segment-2.m4a'],
      duration_seconds: 16,
    });

    await NarrationDraft.open('3', 'https://cdn.example/read.m4a');
    await NarrationDraft.append_clip('file:///tmp/take.m4a', 4, [0.1]);

    expect(append_clip_to_narration).toHaveBeenCalledWith(
      '3',
      'file:///tmp/take.m4a',
      4,
      [0.1],
    );
    expect(NarrationDraft.clips.slice()).toEqual(['segment-1.m4a', 'segment-2.m4a']);
    expect(NarrationDraft.is_dirty).toBe(true);
  });

  test('commit_local merges to a local take without uploading', async () => {
    download_remote_audio.mockResolvedValue('file:///cache/source.m4a');
    normalize_imported_audio.mockResolvedValue({
      duration_seconds: 12,
      uri: 'file:///tmp/normalized.m4a',
      waveform: [0.2],
    });
    create_narration_draft.mockResolvedValue(DRAFT_SNAPSHOT);

    await NarrationDraft.open('3', 'https://cdn.example/read.m4a');
    const result = await NarrationDraft.commit_local();

    expect(merge_episode_clips).toHaveBeenCalledWith({
      clips: ['segment-1.m4a'],
      folder_uri: 'file:///narrations/3/',
    });
    expect(copy_narration_take).toHaveBeenCalledWith(
      'file:///narrations/post-3/exported.m4a',
    );
    expect(result).toEqual({
      duration_seconds: 12,
      uri: 'file:///cache/narration-take-1.m4a',
      waveform: [0.2, 0.4],
    });
    expect(NarrationDraft.pending_take).toEqual(result);
    expect(delete_narration_draft).toHaveBeenCalledWith('3');
    expect(NarrationDraft.post_uid).toBeNull();
    expect(NarrationDraft.clips.length).toBe(0);
    expect(NarrationDraft.is_dirty).toBe(false);
    expect(NarrationDraft.consume_pending_take()).toEqual(result);
    expect(NarrationDraft.pending_take).toBeNull();
  });

  test('commit_local refuses an empty draft', async () => {
    await expect(NarrationDraft.commit_local()).rejects.toThrow(
      'This narration has no audio to save.',
    );
    expect(copy_narration_take).not.toHaveBeenCalled();
  });

  test('update_clips refuses to drop the last segment', async () => {
    download_remote_audio.mockResolvedValue('file:///cache/source.m4a');
    normalize_imported_audio.mockResolvedValue({
      duration_seconds: 12,
      uri: 'file:///tmp/normalized.m4a',
      waveform: [0.2],
    });
    create_narration_draft.mockResolvedValue(DRAFT_SNAPSHOT);

    await NarrationDraft.open('3', 'https://cdn.example/read.m4a');

    await expect(NarrationDraft.update_clips([])).rejects.toThrow(
      'Narration needs at least one segment.',
    );
    expect(replace_narration_clips).not.toHaveBeenCalled();
    expect(NarrationDraft.clips.slice()).toEqual(['segment-1.m4a']);
  });
});
