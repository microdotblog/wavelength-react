import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { File } from 'expo-file-system';
import { observer } from 'mobx-react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import Episodes from '../stores/Episodes';
import HeaderPillButton from '../components/HeaderPillButton';
import RecordingWaveform from '../components/RecordingWaveform';
import { downsample_waveform, WAVEFORM_SAMPLE_COUNT } from '../lib/downsample_waveform';
import { format_clock } from '../lib/format_duration';
import { normalize_metering } from '../lib/normalize_metering';
import { use_recording_waveform_levels } from '../hooks/use_recording_waveform_levels';
import { header_left_element, with_color_opacity } from '../theme/wavelengthTheme';

const MINIMUM_RECORDING_SECONDS = 1;
const RECORDER_POLL_MS = 50;
const ACTIONS_FADE_MS = 220;
const RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
};

function RecordScreen({ navigation, theme }) {
  const audio_recorder = useAudioRecorder(RECORDING_OPTIONS);
  const recorder_state = useAudioRecorderState(audio_recorder, RECORDER_POLL_MS);
  const [permission_status, set_permission_status] = React.useState('pending');
  const [recording_phase, set_recording_phase] = React.useState('idle');
  const [is_saving, set_is_saving] = React.useState(false);
  const captured_samples_ref = React.useRef([]);
  const done_handler_ref = React.useRef(null);
  const actions_opacity = useSharedValue(0);
  const actions_translate = useSharedValue(8);

  React.useEffect(() => {
    let is_cancelled = false;

    async function prepare_audio() {
      const permission = await requestRecordingPermissionsAsync();

      if (is_cancelled) {
        return;
      }

      set_permission_status(permission.granted ? 'granted' : 'denied');

      if (permission.granted) {
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });
      }
    }

    prepare_audio();

    return () => {
      is_cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!recorder_state.isRecording || !Number.isFinite(recorder_state.metering)) {
      return;
    }

    captured_samples_ref.current.push(normalize_metering(recorder_state.metering));
  }, [recorder_state.isRecording, recorder_state.metering, recorder_state.durationMillis]);

  React.useEffect(() => {
    const is_paused = recording_phase === 'paused';
    actions_opacity.value = withTiming(is_paused ? 1 : 0, { duration: ACTIONS_FADE_MS });
    actions_translate.value = withTiming(is_paused ? 0 : 8, { duration: ACTIONS_FADE_MS });
  }, [recording_phase, actions_opacity, actions_translate]);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      gestureEnabled: recording_phase === 'idle',
      ...header_left_element(() => (
        <HeaderPillButton
          label="Done"
          onPress={() => done_handler_ref.current?.()}
          theme={theme}
        />
      )),
    });
  }, [navigation, recording_phase, theme]);

  async function start_recording() {
    if (permission_status !== 'granted' || is_saving) {
      return;
    }

    captured_samples_ref.current = [];
    await audio_recorder.prepareToRecordAsync(RECORDING_OPTIONS);
    audio_recorder.record();
    set_recording_phase('recording');
  }

  function pause_recording() {
    audio_recorder.pause();
    set_recording_phase('paused');
  }

  function resume_recording() {
    audio_recorder.record();
    set_recording_phase('recording');
  }

  async function save_recording() {
    if (is_saving) {
      return;
    }

    const captured_seconds = Math.max(
      recorder_state.durationMillis / 1000,
      audio_recorder.currentTime || 0,
    );

    if (captured_seconds < MINIMUM_RECORDING_SECONDS) {
      Alert.alert(
        'Recording too short',
        'Hold on a moment longer so there is something to save.',
      );
      return;
    }

    set_is_saving(true);
    await audio_recorder.stop();

    const recording_uri = audio_recorder.uri;

    if (!recording_uri) {
      set_is_saving(false);
      Alert.alert('Something went wrong', 'That recording could not be saved.');
      return;
    }

    const waveform = downsample_waveform(captured_samples_ref.current, WAVEFORM_SAMPLE_COUNT);
    const episode_id = await Episodes.create_from_recording(recording_uri, captured_seconds, waveform);
    set_is_saving(false);
    navigation.replace('Edit', { episode_id });
  }

  async function discard_recording() {
    try {
      await audio_recorder.stop();
    } catch (error) {
      // The recorder may already be stopped; deletion below still runs.
    }

    const recording_uri = audio_recorder.uri;

    if (recording_uri) {
      try {
        new File(recording_uri).delete();
      } catch (error) {
        // A missing temp file is fine to ignore.
      }
    }

    captured_samples_ref.current = [];
    set_is_saving(false);
    set_recording_phase('idle');
  }

  function handle_press() {
    if (recording_phase === 'recording') {
      pause_recording();
    } else if (recording_phase === 'paused') {
      resume_recording();
    } else {
      start_recording();
    }
  }

  function confirm_discard_take() {
    Alert.alert(
      'Delete recording?',
      'This removes the current take without saving it.',
      [
        {
          style: 'cancel',
          text: 'Cancel',
        },
        {
          onPress: discard_recording,
          style: 'destructive',
          text: 'Delete',
        },
      ],
    );
  }

  async function discard_and_leave() {
    await discard_recording();
    navigation.goBack();
  }

  function handle_done_press() {
    if (recording_phase === 'idle') {
      navigation.goBack();
      return;
    }

    Alert.alert(
      'Discard recording?',
      'You have an unsaved recording. Discard it and leave?',
      [
        {
          style: 'cancel',
          text: 'Cancel',
        },
        {
          onPress: discard_and_leave,
          style: 'destructive',
          text: 'Discard',
        },
      ],
    );
  }

  done_handler_ref.current = handle_done_press;

  const is_active_recording = recording_phase === 'recording';
  const waveform_levels = use_recording_waveform_levels({
    duration_millis: recorder_state.durationMillis,
    is_recording: is_active_recording,
    metering: recorder_state.metering,
  });
  const timer_label = format_clock(recorder_state.durationMillis);
  const status_label = resolve_status_label({ is_saving, permission_status, recording_phase });
  const record_button_label = resolve_record_button_label(recording_phase);
  const is_button_disabled = permission_status !== 'granted' || is_saving;
  const is_paused = recording_phase === 'paused';

  const actions_style = useAnimatedStyle(() => ({
    opacity: actions_opacity.value,
    transform: [{ translateY: actions_translate.value }],
  }));

  return (
    <SafeAreaView
      edges={['bottom']}
      style={[styles.screen, { backgroundColor: theme.colors.canvas }]}
    >
      <View style={styles.content}>
        <View style={styles.timerBlock}>
          <Text style={[styles.timer, { color: theme.colors.ink }]}>
            {timer_label}
          </Text>
          <Text style={[styles.status, { color: theme.colors.ink_soft }]}>
            {status_label}
          </Text>
        </View>

        <RecordingWaveform
          is_recording={is_active_recording}
          levels={waveform_levels}
          theme={theme}
        />

        {permission_status === 'denied' ? (
          <Text style={[styles.permissionMessage, { color: theme.colors.accent_strong }]}>
            Wavelength needs microphone access to record. Enable it in Settings, then come back.
          </Text>
        ) : null}

        <Pressable
          accessibilityLabel={record_button_label}
          accessibilityRole="button"
          disabled={is_button_disabled}
          onPress={handle_press}
          style={({ pressed }) => [
            styles.recordButton,
            {
              backgroundColor: with_color_opacity(theme.colors.accent, theme.is_dark ? 0.18 : 0.12),
              borderColor: theme.colors.accent,
              opacity: is_button_disabled ? 0.5 : 1,
            },
            pressed && !is_button_disabled ? styles.pressed : null,
          ]}
        >
          {render_record_icon(recording_phase, theme.colors.accent)}
        </Pressable>
      </View>

      <Animated.View
        pointerEvents={is_paused ? 'auto' : 'none'}
        style={[styles.pausedActions, actions_style]}
      >
        <Pressable
          accessibilityRole="button"
          disabled={is_saving}
          onPress={save_recording}
          style={({ pressed }) => [
            styles.saveButton,
            { backgroundColor: theme.colors.accent, opacity: is_saving ? 0.6 : 1 },
            pressed ? styles.pressed : null,
          ]}
        >
          <Text style={[styles.saveButtonText, { color: theme.colors.button_text }]}>
            Save episode
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          disabled={is_saving}
          onPress={confirm_discard_take}
          style={({ pressed }) => [
            styles.deleteButton,
            {
              backgroundColor: with_color_opacity(theme.colors.accent, theme.is_dark ? 0.16 : 0.1),
              borderColor: theme.colors.line,
            },
            pressed ? styles.pressed : null,
          ]}
        >
          <Text style={[styles.deleteButtonText, { color: theme.colors.accent_strong }]}>
            Delete recording
          </Text>
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}

function render_record_icon(recording_phase, color) {
  if (recording_phase === 'recording') {
    return (
      <View style={styles.pauseIcon}>
        <View style={[styles.pauseBar, { backgroundColor: color }]} />
        <View style={[styles.pauseBar, { backgroundColor: color }]} />
      </View>
    );
  }

  return <View style={[styles.recordDot, { backgroundColor: color }]} />;
}

function resolve_status_label({ is_saving, permission_status, recording_phase }) {
  if (permission_status === 'pending') {
    return 'Checking microphone access...';
  }

  if (permission_status === 'denied') {
    return 'Microphone access needed';
  }

  if (is_saving) {
    return 'Saving episode...';
  }

  if (recording_phase === 'recording') {
    return 'Tap to pause';
  }

  if (recording_phase === 'paused') {
    return 'Tap to resume';
  }

  return 'Tap to record';
}

function resolve_record_button_label(recording_phase) {
  if (recording_phase === 'recording') {
    return 'Pause recording';
  }

  if (recording_phase === 'paused') {
    return 'Resume recording';
  }

  return 'Start recording';
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    flex: 1,
    gap: 24,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  deleteButton: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 20,
  },
  pauseBar: {
    borderRadius: 4,
    height: 52,
    width: 16,
  },
  pauseIcon: {
    flexDirection: 'row',
    gap: 10,
  },
  pausedActions: {
    bottom: 16,
    gap: 12,
    left: 24,
    position: 'absolute',
    right: 24,
  },
  permissionMessage: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.72,
  },
  recordButton: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 70,
    borderWidth: 2,
    height: 140,
    justifyContent: 'center',
    width: 140,
  },
  recordDot: {
    borderRadius: 32,
    height: 64,
    width: 64,
  },
  saveButton: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 18,
    justifyContent: 'center',
    minHeight: 52,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
  },
  screen: {
    flex: 1,
  },
  status: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  timer: {
    fontSize: 64,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
    lineHeight: 72,
  },
  timerBlock: {
    alignItems: 'center',
    gap: 6,
  },
});

export default observer(RecordScreen);
