jest.mock('react-native', () => ({
  Alert: { alert: jest.fn() },
  Platform: { OS: 'ios' },
  Pressable: 'Pressable',
  StyleSheet: {
    create: styles => styles,
  },
  Text: 'Text',
  View: 'View',
}));

const mock_recorder = {
  currentTime: 0,
  getStatus: jest.fn(() => ({ canRecord: true, isRecording: false })),
  isRecording: false,
  pause: jest.fn(),
  prepareToRecordAsync: jest.fn(async () => {}),
  record: jest.fn(),
  stop: jest.fn(async () => {}),
  uri: null,
};
let mock_recorder_state = {};

jest.mock('expo-audio', () => ({
  RecordingPresets: { HIGH_QUALITY: {} },
  requestRecordingPermissionsAsync: jest.fn(async () => ({ granted: true })),
  useAudioRecorder: () => mock_recorder,
  useAudioRecorderState: () => mock_recorder_state,
}));

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn(async () => {}),
  deactivateKeepAwake: jest.fn(async () => {}),
}));

jest.mock('mobx-react', () => ({
  observer: component => component,
}));

jest.mock('@react-navigation/elements', () => ({
  HeaderBackButton: 'HeaderBackButton',
}));

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: 'Animated.View' },
  useAnimatedStyle: () => ({}),
  useSharedValue: value => ({ value }),
  withTiming: value => value,
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }) => children,
}));

jest.mock('../../stores/Episodes', () => ({}));
jest.mock('../../stores/NarrationDraft', () => ({}));
jest.mock('../../components/RecordControlButton', () => 'RecordControlButton');
jest.mock('../../components/RecordingWaveform', () => 'RecordingWaveform');

jest.mock('../../hooks/use_recording_waveform_levels', () => ({
  use_recording_waveform_levels: () => [],
}));

jest.mock('../../navigation/SidebarContext', () => ({
  use_sidebar_navigation_guard: jest.fn(),
}));

jest.mock('../../lib/recording_audio_mode', () => ({
  enable_recording_audio_mode: jest.fn(async () => {}),
  get_recording_options: jest.fn(() => ({})),
}));

jest.mock('../../lib/recording_live_activity', () => ({
  end_recording_live_activity: jest.fn(async () => {}),
  sync_recording_live_activity: jest.fn(async () => {}),
}));

jest.mock('../../theme/wavelengthTheme', () => ({
  with_color_opacity: color => color,
}));

const React = require('react');
const { act, render } = require('@testing-library/react-native');
const RecordScreen = require('../RecordScreen').default;
const {
  end_recording_live_activity,
  sync_recording_live_activity,
} = require('../../lib/recording_live_activity');
const { RECORDING_LIVE_ACTIVITY_HOUR_MS } = require('../../lib/recording_live_activity_props');

const theme = {
  colors: {
    accent: '#ff8800',
    accent_strong: '#cc6600',
    button_text: '#ffffff',
    canvas: '#fffaf0',
    ink: '#24180d',
    ink_soft: '#756657',
    line: '#eee',
  },
  is_dark: false,
};

function render_record_screen() {
  const props = {
    navigation: {
      goBack: jest.fn(),
      replace: jest.fn(),
      setOptions: jest.fn(),
      setParams: jest.fn(),
    },
    route: { key: 'Record-1', params: { auto_start: true } },
    theme,
  };

  return render(React.createElement(RecordScreen, props)).then(screen => ({
    ...screen,
    rerender_with_state: async (state) => {
      mock_recorder_state = { ...mock_recorder_state, ...state };
      await screen.rerender(React.createElement(RecordScreen, props));
    },
  }));
}

async function flush_start() {
  await act(async () => {});
}

describe('RecordScreen Live Activity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mock_recorder.currentTime = 0;
    mock_recorder_state = {
      canRecord: true,
      durationMillis: 0,
      isRecording: false,
      metering: null,
    };
  });

  test('starts a fresh take at zero even when the recorder still reports the last take', async () => {
    mock_recorder.currentTime = 42;
    mock_recorder_state.durationMillis = 42_000;

    await render_record_screen();
    await flush_start();

    expect(sync_recording_live_activity).toHaveBeenCalledWith({
      duration_ms: 0,
      phase: 'recording',
    });
    expect(sync_recording_live_activity).not.toHaveBeenCalledWith(
      expect.objectContaining({ duration_ms: 42_000 }),
    );
  });

  test('widens the timer once when the take passes an hour', async () => {
    const screen = await render_record_screen();
    await flush_start();
    sync_recording_live_activity.mockClear();

    await screen.rerender_with_state({
      durationMillis: RECORDING_LIVE_ACTIVITY_HOUR_MS + 1000,
      isRecording: true,
    });
    await screen.rerender_with_state({
      durationMillis: RECORDING_LIVE_ACTIVITY_HOUR_MS + 2000,
    });

    expect(sync_recording_live_activity).toHaveBeenCalledTimes(1);
    expect(sync_recording_live_activity).toHaveBeenCalledWith({
      duration_ms: RECORDING_LIVE_ACTIVITY_HOUR_MS + 1000,
      phase: 'recording',
    });
  });

  test('ends the activity when the take stops natively', async () => {
    const screen = await render_record_screen();
    await flush_start();
    await screen.rerender_with_state({ durationMillis: 5000, isRecording: true });
    end_recording_live_activity.mockClear();

    await screen.rerender_with_state({ canRecord: false, isRecording: false });

    expect(end_recording_live_activity).toHaveBeenCalledTimes(1);
  });

  test('ends the activity when the screen unmounts', async () => {
    const screen = await render_record_screen();
    await flush_start();
    end_recording_live_activity.mockClear();

    await screen.unmount();

    expect(end_recording_live_activity).toHaveBeenCalledTimes(1);
  });
});
