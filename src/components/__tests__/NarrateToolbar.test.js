jest.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Platform: { OS: 'ios', select: options => options.ios ?? options.default },
  Pressable: 'Pressable',
  StyleSheet: {
    create: styles => styles,
    flatten: style => {
      if (Array.isArray(style)) {
        return Object.assign({}, ...style.filter(Boolean));
      }

      return style || {};
    },
    hairlineWidth: 1,
  },
  Text: 'Text',
  View: 'View',
}));

jest.mock('mobx-react', () => ({
  observer: component => component,
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

jest.mock('react-native-reanimated', () => {
  const View = 'View';
  const chainable_animation = () => {
    const animation = {
      delay() {
        return animation;
      },
      duration() {
        return animation;
      },
      easing() {
        return animation;
      },
      springify() {
        return animation;
      },
    };

    return animation;
  };

  return {
    __esModule: true,
    default: { View },
    Easing: {
      inOut: () => ({}),
      quad: {},
      sin: {},
    },
    FadeIn: chainable_animation(),
    LinearTransition: chainable_animation(),
    cancelAnimation: jest.fn(),
    useAnimatedStyle: () => ({}),
    useSharedValue: (value) => ({ value }),
    withRepeat: (value) => value,
    withSequence: (value) => value,
    withTiming: (value) => value,
  };
});

jest.mock('../PlatformSymbol', () => 'PlatformSymbol');
jest.mock('../PlaybackProgressBar', () => 'PlaybackProgressBar');
jest.mock('../PlaybackWaveform', () => 'PlaybackWaveform');
jest.mock('../RecordPulseRings', () => 'RecordPulseRings');
jest.mock('../RecordingWaveform', () => {
  const React = require('react');
  return function RecordingWaveform({ is_recording }) {
    return React.createElement('View', {
      accessibilityLabel: is_recording ? 'Recording level' : 'Ready to record',
    });
  };
});
jest.mock('../../theme/wavelengthTheme', () => ({
  WAVELENGTH_GOLD: '#ffc400',
  with_color_opacity: (color) => color,
}));

const React = require('react');
const { fireEvent, render } = require('@testing-library/react-native');
const NarrateToolbar = require('../NarrateToolbar').default;
const { resolve_narrate_toolbar_mode, should_entice_narration } = require('../NarrateToolbar');

const theme = {
  colors: {
    accent: '#ff8800',
    accent_strong: '#ff8800',
    button_text: '#ffffff',
    ink: '#24180d',
    ink_soft: '#756657',
  },
  is_dark: false,
};

describe('resolve_narrate_toolbar_mode', () => {
  test('picks the compact toolbar state from recording and audio', () => {
    expect(resolve_narrate_toolbar_mode({ is_attaching: true })).toBe('saving');
    expect(resolve_narrate_toolbar_mode({ permission_status: 'denied' })).toBe('denied');
    expect(resolve_narrate_toolbar_mode({ recording_phase: 'recording' })).toBe('recording');
    expect(resolve_narrate_toolbar_mode({ has_take: true, recording_phase: 'review' })).toBe('review');
    expect(resolve_narrate_toolbar_mode({ has_remote: true })).toBe('remote');
    expect(resolve_narrate_toolbar_mode({})).toBe('idle');
  });
});

describe('should_entice_narration', () => {
  test('animates only before a take exists', () => {
    expect(should_entice_narration('idle')).toBe(true);
    expect(should_entice_narration('denied')).toBe(false);
    expect(should_entice_narration('recording')).toBe(false);
    expect(should_entice_narration('review')).toBe(false);
    expect(should_entice_narration('remote')).toBe(false);
    expect(should_entice_narration('saving')).toBe(false);
  });
});

describe('NarrateToolbar', () => {
  test('idle state starts a recording', async () => {
    const on_record_press = jest.fn();
    const { getByLabelText, getByText } = await render(
      React.createElement(NarrateToolbar, {
        on_record_press,
        theme,
      }),
    );

    expect(getByText('Record narration')).toBeTruthy();
    fireEvent.press(getByLabelText('Start recording'));
    expect(on_record_press).toHaveBeenCalled();
  });

  test('review state saves the take', async () => {
    const on_save = jest.fn();
    const { getByText } = await render(
      React.createElement(NarrateToolbar, {
        has_take: true,
        on_save,
        recording_phase: 'review',
        theme,
      }),
    );

    fireEvent.press(getByText('Save'));
    expect(on_save).toHaveBeenCalled();
  });

  test('recording state shows a live waveform and duration', async () => {
    const { getByLabelText, getByText } = await render(
      React.createElement(NarrateToolbar, {
        duration_seconds: 12,
        recording_phase: 'recording',
        theme,
      }),
    );

    expect(getByLabelText('Recording level')).toBeTruthy();
    expect(getByLabelText('Pause recording')).toBeTruthy();
    expect(getByText('0:12')).toBeTruthy();
    expect(getByText('Discard')).toBeTruthy();
    expect(getByText('Done')).toBeTruthy();
  });
});
