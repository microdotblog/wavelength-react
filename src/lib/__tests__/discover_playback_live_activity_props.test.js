const {
  build_discover_playback_live_activity_props,
} = require('../discover_playback_live_activity_props');

describe('build_discover_playback_live_activity_props', () => {
  test('builds a countdown end time from remaining duration', () => {
    expect(
      build_discover_playback_live_activity_props({
        artist_name: 'Manton',
        artwork_uri: 'file:///shared/cover.jpg',
        now_ms: 1_000_000,
        remaining_ms: 125_000,
        title: 'Morning microcast',
      }),
    ).toEqual({
      artistName: 'Manton',
      artworkUri: 'file:///shared/cover.jpg',
      endsAtMs: 1_125_000,
      startsAtMs: 1_000_000,
      title: 'Morning microcast',
    });
  });

  test('falls back when title or artist is blank', () => {
    expect(
      build_discover_playback_live_activity_props({
        now_ms: 5000,
        remaining_ms: 1000,
      }),
    ).toEqual({
      artistName: 'Discover',
      artworkUri: '',
      endsAtMs: 6000,
      startsAtMs: 5000,
      title: 'Podcast',
    });
  });

  test('clamps invalid remaining time to zero', () => {
    expect(
      build_discover_playback_live_activity_props({
        artist_name: 'Manton',
        now_ms: 1000,
        remaining_ms: Number.NaN,
        title: 'Episode',
      }),
    ).toEqual({
      artistName: 'Manton',
      artworkUri: '',
      endsAtMs: 1000,
      startsAtMs: 1000,
      title: 'Episode',
    });
  });
});
