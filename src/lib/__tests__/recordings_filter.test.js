const {
  RECORDING_FILTER_OPTIONS,
  build_recording_items,
  recording_filter_label,
  recordings_empty_copy,
  recordings_list_status,
} = require('../recordings_filter');

describe('recording_filter_label', () => {
  test('defaults to All', () => {
    expect(recording_filter_label()).toBe('All');
    expect(recording_filter_label('podcasts')).toBe('Podcasts');
    expect(recording_filter_label('narrations')).toBe('Narrations');
    expect(recording_filter_label('nope')).toBe('All');
  });
});

describe('build_recording_items', () => {
  const episodes = [
    { created_at: '2026-06-01T12:00:00Z', id: 'ep-1', published_at: null },
    { created_at: '2026-06-03T12:00:00Z', id: 'ep-2', published_at: '2026-06-04T12:00:00Z' },
  ];
  const posts = [
    {
      content: '<p>Note</p>',
      published_at: '2026-06-05T12:00:00Z',
      uid: 'post-1',
    },
    {
      content: '<audio src="https://micro.blog/r.m4a" preload="metadata" style="display: none"></audio><p>Essay</p>',
      published_at: '2026-06-02T12:00:00Z',
      uid: 'post-2',
    },
    {
      content: '<audio controls src="https://micro.blog/a.m4a"></audio>',
      published_at: '2026-06-06T12:00:00Z',
      uid: 'post-3',
    },
  ];

  test('all mixes local episodes with narrated posts, newest first', () => {
    expect(RECORDING_FILTER_OPTIONS.map(option => option.id)).toEqual([
      'all',
      'podcasts',
      'narrations',
    ]);

    const items = build_recording_items({ episodes, posts });

    expect(items.map(item => item.id)).toEqual([
      'episode:ep-2',
      'narration:post-2',
      'episode:ep-1',
    ]);
    expect(items.map(item => item.kind)).toEqual([
      'episode',
      'narration',
      'episode',
    ]);
  });

  test('podcasts sorts local episodes by created_at', () => {
    const older_published = {
      created_at: '2026-05-01T12:00:00Z',
      id: 'ep-old',
      published_at: '2026-06-10T12:00:00Z',
    };
    const newer_draft = {
      created_at: '2026-06-08T12:00:00Z',
      id: 'ep-new',
      published_at: null,
    };

    expect(build_recording_items({
      episodes: [older_published, newer_draft],
      filter: 'podcasts',
      posts,
    }).map(item => item.id)).toEqual([
      'episode:ep-new',
      'episode:ep-old',
    ]);
  });

  test('podcasts is only local episodes', () => {
    expect(build_recording_items({
      episodes,
      filter: 'podcasts',
      posts,
    }).map(item => item.id)).toEqual([
      'episode:ep-2',
      'episode:ep-1',
    ]);
  });

  test('narrations is only narrated posts', () => {
    expect(build_recording_items({
      episodes,
      filter: 'narrations',
      posts,
    }).map(item => item.id)).toEqual([
      'narration:post-2',
    ]);
  });
});

describe('recordings_list_status', () => {
  test('waits for posts when the filter includes narrations', () => {
    expect(recordings_list_status({
      episodes_did_hydrate: true,
      filter: 'all',
      posts_did_hydrate: false,
    }).is_loading).toBe(true);

    expect(recordings_list_status({
      episodes_did_hydrate: true,
      filter: 'podcasts',
      posts_did_hydrate: false,
    }).is_loading).toBe(false);

    expect(recordings_list_status({
      episodes_did_hydrate: true,
      filter: 'narrations',
      posts_did_hydrate: true,
      posts_error_message: 'Nope',
    })).toEqual({
      error_message: 'Nope',
      is_loading: false,
    });
  });
});

describe('recordings_empty_copy', () => {
  test('keeps the record prompt except for narrations', () => {
    expect(recordings_empty_copy('all').show_record).toBe(true);
    expect(recordings_empty_copy('podcasts').title).toBe('No podcasts yet');
    expect(recordings_empty_copy('narrations')).toEqual({
      body: 'Posts with a hidden audio narration will show up here.',
      show_record: false,
      title: 'No narrations yet',
    });
  });
});
