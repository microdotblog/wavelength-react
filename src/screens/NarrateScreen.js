import React from 'react';
import { Alert, Linking, Platform, StyleSheet, Text, View } from 'react-native';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { File } from 'expo-file-system';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { observer } from 'mobx-react';
import { HeaderBackButton } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import NarrateToolbar from '../components/NarrateToolbar';
import { use_stack_top_inset } from '../hooks/use_stack_top_inset';
import { downsample_waveform, WAVEFORM_SAMPLE_COUNT } from '../lib/downsample_waveform';
import { build_narrate_html, is_narrate_preview_document_url } from '../lib/narrate_html';
import { read_narration_audio_url } from '../lib/narration';
import { post_display_title } from '../lib/micropub_posts';
import { normalize_metering } from '../lib/normalize_metering';
import { enable_playback_audio_mode } from '../lib/playback_audio_mode';
import { enable_recording_audio_mode } from '../lib/recording_audio_mode';
import {
  resolve_phase_after_recorder_state,
  resolve_phase_after_recording_status,
} from '../lib/recording_phase_sync';
import { safe_audio_player_call } from '../lib/safe_audio_player';
import { show_toast } from '../lib/toast';
import Discover from '../stores/Discover';
import Posts from '../stores/Posts';

const MINIMUM_RECORDING_SECONDS = 1;
const RECORDER_POLL_MS = 50;
const PLAYER_STATUS_MS = 100;
const RECORDING_KEEP_AWAKE_TAG = 'wavelength-narration';
const RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
};

function map_recorder_phase(phase = 'idle') {
  if (phase === 'stopped') {
    return 'review';
  }

  return phase;
}

function handle_preview_navigation(request) {
  if (is_narrate_preview_document_url(request?.url)) {
    return true;
  }

  const url = `${request?.url || ''}`.trim();

  if (url) {
    Linking.openURL(url).catch(() => {});
  }

  return false;
}

function delete_take_file(uri = '') {
  const trimmed_uri = `${uri || ''}`.trim();

  if (!trimmed_uri) {
    return;
  }

  try {
    new File(trimmed_uri).delete();
  } catch {
    // A missing temp file is fine to ignore.
  }
}

function NarrateScreen({ navigation, route, theme }) {
  const post_uid = route.params?.post_uid;
  const post = Posts.get_post(post_uid);
  const top_inset = use_stack_top_inset();
  const insets = useSafeAreaInsets();
  const [permission_status, set_permission_status] = React.useState('pending');
  const [recording_phase, set_recording_phase] = React.useState('idle');
  const [take_uri, set_take_uri] = React.useState(null);
  const [take_waveform, set_take_waveform] = React.useState([]);
  const [take_duration, set_take_duration] = React.useState(0);
  const captured_samples_ref = React.useRef([]);
  const done_handler_ref = React.useRef(null);
  const recording_phase_ref = React.useRef(recording_phase);
  const is_discarding_ref = React.useRef(false);
  const last_known_duration_ms_ref = React.useRef(0);
  const has_observed_active_take_ref = React.useRef(false);
  const recording_status_listener_ref = React.useRef(null);
  const take_uri_ref = React.useRef(null);

  recording_phase_ref.current = recording_phase;
  take_uri_ref.current = take_uri;

  const remote_url = read_narration_audio_url(post?.content || '');
  const playback_uri = take_uri || (recording_phase === 'idle' ? remote_url : '') || null;
  const player = useAudioPlayer(playback_uri ? { uri: playback_uri } : null, {
    updateInterval: PLAYER_STATUS_MS,
  });
  const player_status = useAudioPlayerStatus(player);

  recording_status_listener_ref.current = (status) => {
    const previous_phase = recording_phase_ref.current;
    const next_phase = map_recorder_phase(resolve_phase_after_recording_status({
      current_phase: previous_phase === 'review' ? 'stopped' : previous_phase,
      has_error: status?.hasError === true,
      is_finished: status?.isFinished === true,
      is_saving: is_discarding_ref.current,
      media_services_did_reset: status?.mediaServicesDidReset === true,
      url: status?.url || null,
    }));

    if (next_phase !== previous_phase) {
      set_recording_phase(next_phase);

      if (
        next_phase === 'idle'
        && (previous_phase === 'recording' || previous_phase === 'paused')
      ) {
        captured_samples_ref.current = [];
        last_known_duration_ms_ref.current = 0;
        has_observed_active_take_ref.current = false;
        set_take_uri(null);
        set_take_waveform([]);
        set_take_duration(0);
        Alert.alert(
          'Recording interrupted',
          'The system interrupted that take. Start a new recording when you are ready.',
        );
      }
    }
  };

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

      try {
        await enable_recording_audio_mode();
      } catch {
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
    const should_keep_awake = recording_phase === 'recording' || recording_phase === 'paused' || recording_phase === 'review';

    if (!should_keep_awake) {
      deactivateKeepAwake(RECORDING_KEEP_AWAKE_TAG).catch(() => {});
      return;
    }

    activateKeepAwakeAsync(RECORDING_KEEP_AWAKE_TAG).catch(() => {});

    return () => {
      deactivateKeepAwake(RECORDING_KEEP_AWAKE_TAG).catch(() => {});
    };
  }, [recording_phase]);

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

  React.useEffect(() => {
    const next_phase = map_recorder_phase(resolve_phase_after_recorder_state({
      can_record: recorder_state.canRecord === true,
      current_phase: recording_phase === 'review' ? 'stopped' : recording_phase,
      has_observed_active_take: has_observed_active_take_ref.current,
      is_recording: recorder_state.isRecording === true,
      is_saving: is_discarding_ref.current || Posts.is_attaching,
    }));

    if (next_phase !== recording_phase) {
      set_recording_phase(next_phase);
    }
  }, [recorder_state.canRecord, recorder_state.isRecording, recording_phase]);

  React.useEffect(() => {
    if (!recorder_state.isRecording || !Number.isFinite(recorder_state.metering)) {
      return;
    }

    captured_samples_ref.current.push(normalize_metering(recorder_state.metering));
  }, [recorder_state.isRecording, recorder_state.metering, recorder_state.durationMillis]);

  React.useEffect(() => {
    if (recording_phase !== 'review' || take_uri || !audio_recorder.uri) {
      return;
    }

    const captured_seconds = Math.max(
      last_known_duration_ms_ref.current / 1000,
      Number.isFinite(recorder_state.durationMillis) ? recorder_state.durationMillis / 1000 : 0,
    );

    set_take_uri(audio_recorder.uri);
    set_take_waveform(downsample_waveform(captured_samples_ref.current, WAVEFORM_SAMPLE_COUNT));
    set_take_duration(captured_seconds);
  }, [audio_recorder.uri, recorder_state.durationMillis, recording_phase, take_uri]);

  React.useLayoutEffect(() => {
    const title = post ? post_display_title(post) : 'Narrate';
    const can_leave_freely = recording_phase === 'idle' && !Posts.is_attaching;

    if (Platform.OS === 'ios') {
      navigation.setOptions({
        gestureEnabled: can_leave_freely,
        headerLargeTitle: false,
        headerLeft: undefined,
        title,
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
      gestureEnabled: can_leave_freely,
      headerLargeTitle: false,
      headerLeft: () => (
        <HeaderBackButton
          accessibilityLabel="Back"
          displayMode="minimal"
          onPress={() => done_handler_ref.current?.()}
          tintColor={theme.colors.ink}
        />
      ),
      title,
      unstable_headerLeftItems: undefined,
    });
  }, [navigation, post, recording_phase, theme, Posts.is_attaching]);

  React.useEffect(() => {
    const unsubscribe = navigation.addListener('blur', () => {
      safe_audio_player_call(player_status.isLoaded, () => player.pause());
    });

    return unsubscribe;
  }, [navigation, player, player_status.isLoaded]);

  function pause_playback() {
    safe_audio_player_call(player_status.isLoaded, () => player.pause());
  }

  async function start_recording() {
    if (permission_status !== 'granted' || Posts.is_attaching || is_discarding_ref.current) {
      return;
    }

    Discover.clear_playback();
    pause_playback();
    captured_samples_ref.current = [];
    last_known_duration_ms_ref.current = 0;
    has_observed_active_take_ref.current = false;
    set_take_uri(null);
    set_take_waveform([]);
    set_take_duration(0);

    try {
      await enable_recording_audio_mode();
      await audio_recorder.prepareToRecordAsync(RECORDING_OPTIONS);
      audio_recorder.record();
    } catch {
      Alert.alert(
        'Recording failed',
        'Wavelength could not start recording. Check that a microphone is available, then try again.',
      );
      return;
    }

    set_recording_phase('recording');
  }

  function pause_recording() {
    try {
      if (audio_recorder.isRecording) {
        audio_recorder.pause();
      }
    } catch {
      // Native may already be stopped.
    }

    const status = audio_recorder.getStatus?.() || {};
    if (!status.isRecording && !status.canRecord) {
      set_recording_phase('review');
      return;
    }

    set_recording_phase('paused');
  }

  function resume_recording() {
    try {
      audio_recorder.record();
      set_recording_phase('recording');
    } catch {
      Alert.alert(
        'Could not resume',
        'That take already ended. Save it, or discard it and record again.',
      );
      set_recording_phase('review');
    }
  }

  function handle_record_press() {
    if (recording_phase === 'recording') {
      pause_recording();
      return;
    }

    if (recording_phase === 'paused') {
      resume_recording();
      return;
    }

    start_recording();
  }

  async function finish_take() {
    const captured_seconds = Math.max(
      last_known_duration_ms_ref.current / 1000,
      Number.isFinite(recorder_state.durationMillis) ? recorder_state.durationMillis / 1000 : 0,
      audio_recorder.currentTime || 0,
    );

    if (captured_seconds < MINIMUM_RECORDING_SECONDS) {
      Alert.alert(
        'Recording too short',
        'Hold on a moment longer so there is something to save.',
      );
      return;
    }

    try {
      await audio_recorder.stop();
    } catch {
      // Recorder already finished; fall through and use the existing URI.
    }

    const recording_uri = audio_recorder.uri;

    if (!recording_uri) {
      Alert.alert('Something went wrong', 'That recording could not be saved.');
      return;
    }

    set_take_uri(recording_uri);
    set_take_waveform(downsample_waveform(captured_samples_ref.current, WAVEFORM_SAMPLE_COUNT));
    set_take_duration(captured_seconds);
    set_recording_phase('review');
  }

  async function discard_recording() {
    if (is_discarding_ref.current || Posts.is_attaching) {
      return;
    }

    is_discarding_ref.current = true;
    pause_playback();

    const should_stop = recording_phase_ref.current === 'recording' || recording_phase_ref.current === 'paused';
    captured_samples_ref.current = [];
    last_known_duration_ms_ref.current = 0;
    has_observed_active_take_ref.current = false;
    recording_phase_ref.current = 'idle';
    set_recording_phase('idle');
    set_take_waveform([]);
    set_take_duration(0);

    const uri_to_delete = take_uri_ref.current;

    try {
      if (should_stop) {
        try {
          await audio_recorder.stop();
        } catch {
          // The recorder may already be stopped; deletion below still runs.
        }
      }

      delete_take_file(uri_to_delete || audio_recorder.uri);
    } finally {
      set_take_uri(null);
      is_discarding_ref.current = false;
    }
  }

  function confirm_discard() {
    Alert.alert(
      'Discard recording?',
      'This removes the current take without saving it.',
      [
        {
          style: 'cancel',
          text: 'Cancel',
        },
        {
          onPress: discard_recording,
          style: 'destructive',
          text: 'Discard',
        },
      ],
    );
  }

  async function save_narration() {
    const recording_uri = `${take_uri || audio_recorder.uri || ''}`.trim();

    if (!recording_uri || Posts.is_attaching) {
      return;
    }

    pause_playback();

    try {
      await Posts.attach_narration(post_uid, recording_uri);
      delete_take_file(recording_uri);
      captured_samples_ref.current = [];
      last_known_duration_ms_ref.current = 0;
      has_observed_active_take_ref.current = false;
      set_take_uri(null);
      set_take_waveform([]);
      set_take_duration(0);
      set_recording_phase('idle');
      show_toast('Narration saved.');
    } catch (error) {
      show_toast(error?.message || 'Could not save narration. Please try again.');
    }
  }

  async function handle_toggle_playback() {
    if (!playback_uri) {
      return;
    }

    Discover.clear_playback();

    if (player_status.playing) {
      pause_playback();
      return;
    }

    try {
      await enable_playback_audio_mode();
    } catch {
      // Playback can still proceed in the current audio session.
    }

    safe_audio_player_call(player_status.isLoaded, () => player.play());
  }

  function handle_seek(fraction = 0) {
    const duration = player_status.duration || take_duration || 0;

    if (duration <= 0) {
      return;
    }

    safe_audio_player_call(player_status.isLoaded, () => player.seekTo(fraction * duration));
  }

  async function discard_and_leave() {
    await discard_recording();
    navigation.goBack();
  }

  function handle_done_press() {
    if (is_discarding_ref.current || Posts.is_attaching) {
      return;
    }

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

  if (!post) {
    return (
      <View style={[styles.screen, styles.missingScreen, { backgroundColor: theme.colors.canvas }]}>
        <Text style={[styles.missingText, { color: theme.colors.ink_soft }]}>
          This post is no longer available.
        </Text>
      </View>
    );
  }

  const display_duration_seconds = recording_phase === 'recording' || recording_phase === 'paused'
    ? Math.max(last_known_duration_ms_ref.current / 1000, Number.isFinite(recorder_state.durationMillis) ? recorder_state.durationMillis / 1000 : 0)
    : (player_status.duration || take_duration || 0);
  const display_current_time = recording_phase === 'recording' || recording_phase === 'paused'
    ? display_duration_seconds
    : (player_status.currentTime || 0);

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.canvas }]}>
      <NarratePostPreview
        background_color={theme.colors.canvas}
        content={post.content}
        ink_color={theme.colors.ink}
        ink_soft_color={theme.colors.ink_soft}
        is_dark={theme.is_dark}
        title={post.title}
        top_inset={top_inset}
      />
      <View style={[styles.toolbarWrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <NarrateToolbar
          current_time={display_current_time}
          duration_seconds={display_duration_seconds}
          has_remote={remote_url.length > 0}
          has_take={Boolean(take_uri)}
          is_attaching={Posts.is_attaching}
          is_playing={player_status.playing === true}
          on_discard={confirm_discard}
          on_finish={finish_take}
          on_record_press={handle_record_press}
          on_save={save_narration}
          on_seek={handle_seek}
          on_toggle_playback={handle_toggle_playback}
          permission_status={permission_status}
          recording_phase={recording_phase}
          status_label="Saving narration…"
          theme={theme}
          waveform={take_waveform}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  missingScreen: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  missingText: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    textAlign: 'center',
  },
  preview: {
    flex: 1,
  },
  screen: {
    flex: 1,
  },
  toolbarWrap: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  webview: {
    flex: 1,
  },
});

const NarratePostPreview = React.memo(function NarratePostPreview({
  background_color,
  content,
  ink_color,
  ink_soft_color,
  is_dark,
  title,
  top_inset = 0,
}) {
  const html = React.useMemo(() => (
    build_narrate_html({
      background_color,
      content,
      ink_color,
      ink_soft_color,
      is_dark,
      title,
    })
  ), [background_color, content, ink_color, ink_soft_color, is_dark, title]);

  return (
    <View style={[styles.preview, top_inset > 0 ? { paddingTop: top_inset } : null]}>
      <WebView
        originWhitelist={['*']}
        onShouldStartLoadWithRequest={handle_preview_navigation}
        setSupportMultipleWindows={false}
        source={{ html }}
        style={[styles.webview, { backgroundColor: background_color }]}
      />
    </View>
  );
});

export default observer(NarrateScreen);
