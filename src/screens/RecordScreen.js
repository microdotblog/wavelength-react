import React from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { File } from 'expo-file-system';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { observer } from 'mobx-react';
import { HeaderBackButton } from '@react-navigation/elements';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import Episodes from '../stores/Episodes';
import RecordControlButton from '../components/RecordControlButton';
import RecordingWaveform from '../components/RecordingWaveform';
import { downsample_waveform, WAVEFORM_SAMPLE_COUNT } from '../lib/downsample_waveform';
import { format_clock } from '../lib/format_duration';
import { normalize_metering } from '../lib/normalize_metering';
import { enable_recording_audio_mode } from '../lib/recording_audio_mode';
import {
  is_review_recording_phase,
  resolve_phase_after_recorder_state,
  resolve_phase_after_recording_status,
} from '../lib/recording_phase_sync';
import { use_recording_waveform_levels } from '../hooks/use_recording_waveform_levels';
import { with_color_opacity } from '../theme/wavelengthTheme';

const MINIMUM_RECORDING_SECONDS = 1;
const RECORDER_POLL_MS = 50;
const ACTIONS_FADE_MS = 220;
const RECORDING_KEEP_AWAKE_TAG = 'wavelength-recording';
const RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
};

function RecordScreen({ navigation, route, theme }) {
  const episode_id = route.params?.episode_id;
  const is_appending = typeof episode_id === 'string' && episode_id.length > 0;
  const [permission_status, set_permission_status] = React.useState('pending');
  const [recording_phase, set_recording_phase] = React.useState('idle');
  const [is_saving, set_is_saving] = React.useState(false);
  const captured_samples_ref = React.useRef([]);
  const done_handler_ref = React.useRef(null);
  const start_recording_ref = React.useRef(null);
  const recording_phase_ref = React.useRef(recording_phase);
  const is_saving_ref = React.useRef(is_saving);
  const last_known_duration_ms_ref = React.useRef(0);
  const has_observed_active_take_ref = React.useRef(false);
  const recording_status_listener_ref = React.useRef(null);
  const actions_opacity = useSharedValue(0);
  const actions_translate = useSharedValue(8);

  recording_phase_ref.current = recording_phase;
  is_saving_ref.current = is_saving;

  recording_status_listener_ref.current = (status) => {
    const previous_phase = recording_phase_ref.current;
    const next_phase = resolve_phase_after_recording_status({
      current_phase: previous_phase,
      has_error: status?.hasError === true,
      is_finished: status?.isFinished === true,
      is_saving: is_saving_ref.current,
      media_services_did_reset: status?.mediaServicesDidReset === true,
      url: status?.url || null,
    });

    if (next_phase !== previous_phase) {
      set_recording_phase(next_phase);

      if (
        next_phase === 'idle'
        && (previous_phase === 'recording' || previous_phase === 'paused')
      ) {
        captured_samples_ref.current = [];
        last_known_duration_ms_ref.current = 0;
        has_observed_active_take_ref.current = false;
        Alert.alert(
          'Recording interrupted',
          'The system interrupted that take. Start a new recording when you are ready.',
        );
      }
    }
  };

  // Stable wrapper: useAudioRecorder only rebinds on recorder id, not listener identity.
  const audio_recorder = useAudioRecorder(RECORDING_OPTIONS, (status) => {
    recording_status_listener_ref.current?.(status);
  });
  const recorder_state = useAudioRecorderState(audio_recorder, RECORDER_POLL_MS);

  React.useEffect(() => {
    let is_cancelled = false;

    async function prepare_audio() {
      const permission = await requestRecordingPermissionsAsync();

      if (is_cancelled) {
        return;
      }

      if (!permission.granted) {
        set_permission_status('denied');
        return;
      }

      // Wait for audio mode (and Android notification permission) before enabling
      // record controls / auto-start, so background capture is configured first.
      try {
        await enable_recording_audio_mode();
      } catch (error) {
        // Mode setup rarely fails; start_recording still surfaces prepare errors.
      }

      if (!is_cancelled) {
        set_permission_status('granted');
      }
    }

    prepare_audio();

    return () => {
      is_cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    const should_keep_awake = recording_phase === 'recording' || is_review_recording_phase(recording_phase);

    if (!should_keep_awake) {
      deactivateKeepAwake(RECORDING_KEEP_AWAKE_TAG).catch(() => {});
      return;
    }

    activateKeepAwakeAsync(RECORDING_KEEP_AWAKE_TAG).catch(() => {});

    return () => {
      deactivateKeepAwake(RECORDING_KEEP_AWAKE_TAG).catch(() => {});
    };
  }, [recording_phase]);

  // Keep the last non-zero duration; Android notification Stop resets native duration to 0.
  React.useEffect(() => {
    const is_active = recorder_state.isRecording === true || recorder_state.canRecord === true;

    if (is_active && (recording_phase === 'recording' || recording_phase === 'paused')) {
      has_observed_active_take_ref.current = true;
    }

    if (
      is_active
      && Number.isFinite(recorder_state.durationMillis)
      && recorder_state.durationMillis > last_known_duration_ms_ref.current
    ) {
      last_known_duration_ms_ref.current = recorder_state.durationMillis;
    }
  }, [recorder_state.canRecord, recorder_state.durationMillis, recorder_state.isRecording, recording_phase]);

  // Defense in depth: polled state catches notification Stop if the status event is missed.
  // Wait until the poller has seen an active take so we don't race start → stopped.
  React.useEffect(() => {
    const next_phase = resolve_phase_after_recorder_state({
      can_record: recorder_state.canRecord === true,
      current_phase: recording_phase,
      has_observed_active_take: has_observed_active_take_ref.current,
      is_recording: recorder_state.isRecording === true,
      is_saving,
    });

    if (next_phase !== recording_phase) {
      set_recording_phase(next_phase);
    }
  }, [is_saving, recorder_state.canRecord, recorder_state.isRecording, recording_phase]);

  React.useEffect(() => {
    if (!recorder_state.isRecording || !Number.isFinite(recorder_state.metering)) {
      return;
    }

    captured_samples_ref.current.push(normalize_metering(recorder_state.metering));
  }, [recorder_state.isRecording, recorder_state.metering, recorder_state.durationMillis]);

  React.useEffect(() => {
    const is_reviewing = is_review_recording_phase(recording_phase);
    actions_opacity.value = withTiming(is_reviewing ? 1 : 0, { duration: ACTIONS_FADE_MS });
    actions_translate.value = withTiming(is_reviewing ? 0 : 8, { duration: ACTIONS_FADE_MS });
  }, [recording_phase, actions_opacity, actions_translate]);

  React.useLayoutEffect(() => {
    if (Platform.OS === 'ios') {
      navigation.setOptions({
        gestureEnabled: recording_phase === 'idle',
        headerLargeTitle: false,
        headerLeft: undefined,
        unstable_headerLeftItems: () => [
          {
            accessibilityLabel: 'Back',
            icon: { name: 'chevron.left', type: 'sfSymbol' },
            label: '',
            onPress: () => done_handler_ref.current?.(),
            tintColor: theme.colors.ink,
            type: 'button',
          },
        ],
      });
      return;
    }

    navigation.setOptions({
      gestureEnabled: recording_phase === 'idle',
      headerLargeTitle: false,
      headerLeft: () => (
        <HeaderBackButton
          accessibilityLabel="Back"
          displayMode="minimal"
          onPress={() => done_handler_ref.current?.()}
          tintColor={theme.colors.ink}
        />
      ),
      unstable_headerLeftItems: undefined,
    });
  }, [navigation, recording_phase, theme]);

  async function start_recording() {
    if (permission_status !== 'granted' || is_saving) {
      return;
    }

    captured_samples_ref.current = [];
    last_known_duration_ms_ref.current = 0;
    has_observed_active_take_ref.current = false;

    try {
      await audio_recorder.prepareToRecordAsync(RECORDING_OPTIONS);
      audio_recorder.record();
    } catch (error) {
      Alert.alert(
        'Recording failed',
        'Wavelength could not start recording. Check that a microphone is available, then try again.',
      );
      return;
    }

    set_recording_phase('recording');
  }

  start_recording_ref.current = start_recording;

  React.useEffect(() => {
    if (route.params?.auto_start !== true) {
      return;
    }

    if (permission_status === 'pending') {
      return;
    }

    navigation.setParams({ auto_start: undefined });

    if (permission_status === 'denied' || is_saving || recording_phase !== 'idle') {
      return;
    }

    start_recording_ref.current?.();
  }, [is_saving, navigation, permission_status, recording_phase, route.params?.auto_start]);

  function pause_recording() {
    try {
      if (audio_recorder.isRecording) {
        audio_recorder.pause();
      }
    } catch (error) {
      // Native may already be stopped (e.g. Android notification Stop).
    }

    const status = audio_recorder.getStatus?.() || {};
    if (!status.isRecording && !status.canRecord) {
      set_recording_phase('stopped');
      return;
    }

    set_recording_phase('paused');
  }

  function resume_recording() {
    if (recording_phase === 'stopped') {
      return;
    }

    try {
      audio_recorder.record();
      set_recording_phase('recording');
    } catch (error) {
      Alert.alert(
        'Could not resume',
        'That take already ended. Save it, or delete it and record again.',
      );
      set_recording_phase('stopped');
    }
  }

  async function save_recording() {
    if (is_saving) {
      return;
    }

    const captured_seconds = Math.max(
      last_known_duration_ms_ref.current / 1000,
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

    is_saving_ref.current = true;
    set_is_saving(true);

    // Notification Stop may have already finalized the file; never let a second
    // stop() throw and leave the take unsaved.
    if (recording_phase !== 'stopped') {
      try {
        await audio_recorder.stop();
      } catch (error) {
        // Recorder already finished; fall through and use the existing URI.
      }
    }

    const recording_uri = audio_recorder.uri;

    if (!recording_uri) {
      is_saving_ref.current = false;
      set_is_saving(false);
      Alert.alert('Something went wrong', 'That recording could not be saved.');
      return;
    }

    const waveform = downsample_waveform(captured_samples_ref.current, WAVEFORM_SAMPLE_COUNT);

    try {
      if (is_appending) {
        await Episodes.append_clip_to_episode(episode_id, recording_uri, captured_seconds, waveform);
        Episodes.export_merged_audio(episode_id);
        is_saving_ref.current = false;
        set_is_saving(false);
        set_recording_phase('idle');
        navigation.goBack();
        return;
      }

      const created_episode_id = await Episodes.create_from_recording(recording_uri, captured_seconds, waveform);
      is_saving_ref.current = false;
      set_is_saving(false);
      set_recording_phase('idle');
      navigation.replace('Edit', { episode_id: created_episode_id });
    } catch (error) {
      is_saving_ref.current = false;
      set_is_saving(false);
      Alert.alert('Something went wrong', 'That recording could not be saved.');
    }
  }

  async function discard_recording() {
    // Flip to idle before stop(). Otherwise the finished-status listener / poller
    // see paused→finished and park us in "Recording stopped" (same race save
    // avoids with is_saving). Update the ref now; render would be too late.
    const should_stop = recording_phase_ref.current !== 'stopped';
    captured_samples_ref.current = [];
    last_known_duration_ms_ref.current = 0;
    has_observed_active_take_ref.current = false;
    recording_phase_ref.current = 'idle';
    set_is_saving(false);
    set_recording_phase('idle');

    if (should_stop) {
      try {
        await audio_recorder.stop();
      } catch (error) {
        // The recorder may already be stopped; deletion below still runs.
      }
    }

    const recording_uri = audio_recorder.uri;

    if (recording_uri) {
      try {
        new File(recording_uri).delete();
      } catch (error) {
        // A missing temp file is fine to ignore.
      }
    }
  }

  function handle_press() {
    if (recording_phase === 'recording') {
      pause_recording();
    } else if (recording_phase === 'paused') {
      resume_recording();
    } else if (recording_phase === 'stopped') {
      // Take already finished natively; only Save / Delete apply.
      return;
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
  const is_reviewing = is_review_recording_phase(recording_phase);
  // Idle ignores native duration: after delete/stop the recorder can still report the old take.
  const display_duration_ms = recording_phase === 'idle'
    ? 0
    : Math.max(
      last_known_duration_ms_ref.current,
      Number.isFinite(recorder_state.durationMillis) ? recorder_state.durationMillis : 0,
    );
  const waveform_levels = use_recording_waveform_levels({
    duration_millis: display_duration_ms,
    is_recording: is_active_recording,
    metering: recorder_state.metering,
  });
  const timer_label = format_clock(display_duration_ms);
  const status_label = resolve_status_label({ is_appending, is_saving, permission_status, recording_phase });
  const is_button_disabled = permission_status !== 'granted' || is_saving || recording_phase === 'stopped';

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
        <View style={styles.paddedBlock}>
          <View style={styles.timerBlock}>
            <Text style={[styles.timer, { color: theme.colors.ink }]}>
              {timer_label}
            </Text>
            <Text style={[styles.status, { color: theme.colors.ink_soft }]}>
              {status_label}
            </Text>
          </View>
        </View>

        <RecordingWaveform
          attention={recording_phase === 'idle'}
          is_recording={is_active_recording}
          levels={waveform_levels}
          theme={theme}
        />

        <View style={styles.paddedBlock}>
          {permission_status === 'denied' ? (
            <Text style={[styles.permissionMessage, { color: theme.colors.accent_strong }]}>
              Wavelength needs microphone access to record. Enable it in Settings, then come back.
            </Text>
          ) : null}

          <RecordControlButton
            disabled={is_button_disabled}
            metering={recorder_state.metering}
            onPress={handle_press}
            recording_phase={recording_phase}
            theme={theme}
          />
        </View>
      </View>

      <Animated.View
        pointerEvents={is_reviewing ? 'auto' : 'none'}
        style={[styles.pausedActions, actions_style]}
      >
        <Pressable
          accessibilityLabel={is_appending ? 'Save segment' : 'Save episode'}
          accessibilityRole="button"
          accessibilityState={{ disabled: is_saving }}
          disabled={is_saving}
          onPress={save_recording}
          style={({ pressed }) => [
            styles.saveButton,
            { backgroundColor: theme.colors.accent, opacity: is_saving ? 0.6 : 1 },
            pressed ? styles.pressed : null,
          ]}
        >
          <Text style={[styles.saveButtonText, { color: theme.colors.button_text }]}>
            {is_appending ? 'Save segment' : 'Save episode'}
          </Text>
        </Pressable>

        <Pressable
          accessibilityLabel="Delete recording"
          accessibilityRole="button"
          accessibilityState={{ disabled: is_saving }}
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

function resolve_status_label({ is_appending, is_saving, permission_status, recording_phase }) {
  if (permission_status === 'pending') {
    return 'Checking microphone access...';
  }

  if (permission_status === 'denied') {
    return 'Microphone access needed';
  }

  if (is_saving) {
    return is_appending ? 'Saving segment...' : 'Saving episode...';
  }

  if (recording_phase === 'recording') {
    return 'Tap to pause';
  }

  if (recording_phase === 'paused') {
    return 'Tap to resume';
  }

  if (recording_phase === 'stopped') {
    return 'Recording stopped — save or delete';
  }

  return 'Tap to record';
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'stretch',
    flex: 1,
    gap: 24,
    justifyContent: 'center',
  },
  paddedBlock: {
    alignItems: 'center',
    gap: 24,
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
