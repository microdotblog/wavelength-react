import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { observer } from 'mobx-react';
import { SafeAreaView } from 'react-native-safe-area-context';

import Episodes from '../stores/Episodes';
import { format_clock } from '../lib/format_duration';
import { with_color_opacity } from '../theme/wavelengthTheme';

const MINIMUM_RECORDING_SECONDS = 1;

function RecordScreen({ navigation, theme }) {
  const audio_recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorder_state = useAudioRecorderState(audio_recorder);
  const [permission_status, set_permission_status] = React.useState('pending');
  const [is_saving, set_is_saving] = React.useState(false);

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

  async function start_recording() {
    if (permission_status !== 'granted' || is_saving) {
      return;
    }

    await audio_recorder.prepareToRecordAsync();
    audio_recorder.record();
  }

  async function stop_recording() {
    if (is_saving) {
      return;
    }

    const captured_seconds = Math.max(
      recorder_state.durationMillis / 1000,
      audio_recorder.currentTime || 0,
    );

    set_is_saving(true);
    await audio_recorder.stop();

    const recording_uri = audio_recorder.uri;

    if (!recording_uri || captured_seconds < MINIMUM_RECORDING_SECONDS) {
      set_is_saving(false);
      Alert.alert(
        'Recording too short',
        'Hold on a moment longer so there is something to save.',
      );
      return;
    }

    const episode_id = await Episodes.create_from_recording(recording_uri, captured_seconds);
    set_is_saving(false);
    navigation.replace('Edit', { episode_id });
  }

  function handle_press() {
    if (recorder_state.isRecording) {
      stop_recording();
    } else {
      start_recording();
    }
  }

  const is_recording = recorder_state.isRecording;
  const timer_label = format_clock(recorder_state.durationMillis);
  const status_label = resolve_status_label({ is_recording, is_saving, permission_status });
  const is_button_disabled = permission_status !== 'granted' || is_saving;

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

        {permission_status === 'denied' ? (
          <Text style={[styles.permissionMessage, { color: theme.colors.accent_strong }]}>
            Wavelength needs microphone access to record. Enable it in Settings, then come back.
          </Text>
        ) : null}

        <Pressable
          accessibilityLabel={is_recording ? 'Stop recording' : 'Start recording'}
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
          <View
            style={[
              is_recording ? styles.recordButtonStop : styles.recordButtonDot,
              { backgroundColor: theme.colors.accent },
            ]}
          />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function resolve_status_label({ is_recording, is_saving, permission_status }) {
  if (permission_status === 'pending') {
    return 'Checking microphone access...';
  }

  if (permission_status === 'denied') {
    return 'Microphone access needed';
  }

  if (is_saving) {
    return 'Saving episode...';
  }

  if (is_recording) {
    return 'Tap to stop';
  }

  return 'Tap to record';
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    flex: 1,
    gap: 28,
    justifyContent: 'center',
    paddingHorizontal: 24,
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
  recordButtonDot: {
    borderRadius: 32,
    height: 64,
    width: 64,
  },
  recordButtonStop: {
    borderRadius: 8,
    height: 52,
    width: 52,
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
