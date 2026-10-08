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

jest.mock('../../live_activities/RecordingLiveActivity', () => ({
  __esModule: true,
  default: mock_factory,
}));

const { Platform } = require('react-native');
const {
  end_recording_live_activity,
  reset_recording_live_activity_for_tests,
  sync_recording_live_activity,
} = require('../recording_live_activity');

describe('recording_live_activity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'ios';
    reset_recording_live_activity_for_tests();
    mock_factory.getInstances.mockReturnValue([]);
    mock_factory.start.mockReturnValue(mock_instance);
  });

  test('starts a Live Activity when recording begins', async () => {
    await sync_recording_live_activity({
      duration_ms: 0,
      phase: 'recording',
    });

    expect(mock_factory.start).toHaveBeenCalledTimes(1);
    expect(mock_factory.start).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: 'recording',
        statusLabel: 'Recording',
        pauseTimeMs: null,
      }),
      'wavelength://record',
    );
  });

  test('updates the existing activity when pausing', async () => {
    await sync_recording_live_activity({
      duration_ms: 1000,
      phase: 'recording',
    });
    await sync_recording_live_activity({
      duration_ms: 5000,
      phase: 'paused',
    });

    expect(mock_factory.start).toHaveBeenCalledTimes(1);
    expect(mock_instance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: 'paused',
        statusLabel: 'Paused',
        pauseTimeMs: expect.any(Number),
      }),
    );
  });

  test('ends the activity when returning to idle', async () => {
    await sync_recording_live_activity({
      duration_ms: 1000,
      phase: 'recording',
    });
    await end_recording_live_activity();

    expect(mock_instance.end).toHaveBeenCalledWith('immediate');
  });

  test('is a no-op on Android', async () => {
    Platform.OS = 'android';

    await sync_recording_live_activity({
      duration_ms: 1000,
      phase: 'recording',
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

    const start_promise = sync_recording_live_activity({
      duration_ms: 0,
      phase: 'recording',
    });
    await Promise.resolve();
    const end_promise = end_recording_live_activity();

    resolve_orphans();
    await Promise.all([start_promise, end_promise]);

    // End invalidated the in-flight start; a later start must create a new activity.
    mock_factory.start.mockClear();
    await sync_recording_live_activity({
      duration_ms: 0,
      phase: 'recording',
    });
    expect(mock_factory.start).toHaveBeenCalledTimes(1);
  });

  test('ends the activity when update fails', async () => {
    await sync_recording_live_activity({
      duration_ms: 1000,
      phase: 'recording',
    });
    mock_instance.update.mockRejectedValueOnce(new Error('update failed'));

    await sync_recording_live_activity({
      duration_ms: 2000,
      phase: 'paused',
    });

    expect(mock_instance.end).toHaveBeenCalledWith('immediate');
  });
});
