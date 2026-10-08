jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

const mock_instance = {
  end: jest.fn(async () => {}),
  update: jest.fn(async () => {}),
};

const mock_factory = {
  getInstances: jest.fn(() => []),
  start: jest.fn(() => mock_instance),
};

jest.mock('../../live_activities/DiscoverPlaybackLiveActivity', () => ({
  __esModule: true,
  default: mock_factory,
}));

jest.mock('../preload_discover_playback_artwork', () => ({
  preload_discover_playback_artwork: jest.fn(async () => 'file:///shared/cover.jpg'),
}));

const { Platform } = require('react-native');
const {
  end_discover_playback_live_activity,
  reset_discover_playback_live_activity_for_tests,
  sync_discover_playback_live_activity,
} = require('../discover_playback_live_activity');
const {
  preload_discover_playback_artwork,
} = require('../preload_discover_playback_artwork');

describe('discover_playback_live_activity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'ios';
    reset_discover_playback_live_activity_for_tests();
    mock_factory.getInstances.mockReturnValue([]);
    mock_factory.start.mockReturnValue(mock_instance);
    preload_discover_playback_artwork.mockResolvedValue('file:///shared/cover.jpg');
  });

  test('starts a Live Activity while Discover audio is playing', async () => {
    await sync_discover_playback_live_activity({
      artist_name: 'Manton',
      artwork_url: 'https://example.com/cover.jpg',
      post_id: 'post-1',
      remaining_ms: 60_000,
      title: 'Morning microcast',
    });

    expect(preload_discover_playback_artwork).toHaveBeenCalledWith({
      artwork_url: 'https://example.com/cover.jpg',
      post_id: 'post-1',
    });
    expect(mock_factory.start).toHaveBeenCalledTimes(1);
    expect(mock_factory.start).toHaveBeenCalledWith(
      expect.objectContaining({
        artistName: 'Manton',
        artworkUri: 'file:///shared/cover.jpg',
        title: 'Morning microcast',
        startsAtMs: expect.any(Number),
        endsAtMs: expect.any(Number),
      }),
      'wavelength://discover',
    );
  });

  test('updates the existing activity when remaining time changes', async () => {
    await sync_discover_playback_live_activity({
      artist_name: 'Manton',
      remaining_ms: 60_000,
      title: 'Morning microcast',
    });
    await sync_discover_playback_live_activity({
      artist_name: 'Manton',
      remaining_ms: 30_000,
      title: 'Morning microcast',
    });

    expect(mock_factory.start).toHaveBeenCalledTimes(1);
    expect(mock_instance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Morning microcast',
        endsAtMs: expect.any(Number),
      }),
    );
  });

  test('ends the activity when playback stops', async () => {
    await sync_discover_playback_live_activity({
      remaining_ms: 10_000,
      title: 'Morning microcast',
    });
    await end_discover_playback_live_activity();

    expect(mock_instance.end).toHaveBeenCalledWith('immediate');
  });

  test('is a no-op on Android', async () => {
    Platform.OS = 'android';

    await sync_discover_playback_live_activity({
      remaining_ms: 10_000,
      title: 'Morning microcast',
    });

    expect(mock_factory.start).not.toHaveBeenCalled();
  });

  test('does not keep a Live Activity when end races start', async () => {
    let resolve_orphans;
    mock_factory.getInstances.mockReturnValueOnce([
      {
        end: jest.fn(
          () =>
            new Promise((resolve) => {
              resolve_orphans = resolve;
            }),
        ),
      },
    ]);

    const start_promise = sync_discover_playback_live_activity({
      remaining_ms: 10_000,
      title: 'Morning microcast',
    });
    await Promise.resolve();
    const end_promise = end_discover_playback_live_activity();

    resolve_orphans();
    await Promise.all([start_promise, end_promise]);

    mock_factory.start.mockClear();
    await sync_discover_playback_live_activity({
      remaining_ms: 10_000,
      title: 'Morning microcast',
    });
    expect(mock_factory.start).toHaveBeenCalledTimes(1);
  });
});
