import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { observer } from 'mobx-react';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

import HeaderPillButton from '../components/HeaderPillButton';
import PlatformSymbol from '../components/PlatformSymbol';
import PlaybackControlButton from '../components/PlaybackControlButton';
import PlaybackWaveform from '../components/PlaybackWaveform';
import SegmentList from '../components/SegmentList';
import { use_episode_playback } from '../hooks/use_episode_playback';
import { build_upload_size_limit_message } from '../lib/episode_upload_size';
import {
  resolve_active_clip_index,
  resolve_playback_status_label,
} from '../lib/episode_playback_ui';
import { format_duration } from '../lib/format_duration';
import { post_display_title } from '../lib/micropub_posts';
import NarrationDraft from '../stores/NarrationDraft';
import Posts from '../stores/Posts';
import { header_right_element, with_color_opacity } from '../theme/wavelengthTheme';

const PLAYBACK_WAVEFORM_HEIGHT = 80;

function clip_meta_snapshot(draft) {
  return draft.clip_meta.map(clip => ({
    duration_seconds: clip.duration_seconds,
    name: clip.name,
    size_bytes: clip.size_bytes,
    waveform: clip.waveform.slice(),
  }));
}

function NarrateEditScreen({ navigation, route, theme }) {
  const post_uid = route.params?.post_uid;
  const post = Posts.get_post(post_uid);
  const audio_url = route.params?.audio_url || '';
  const playback = use_episode_playback(NarrationDraft.playback_clips());
  const [is_importing_audio, set_is_importing_audio] = React.useState(false);
  const save_handler_ref = React.useRef(null);
  const playback_pause_ref = React.useRef(null);

  playback_pause_ref.current = playback.pause;

  React.useEffect(() => {
    let cancelled = false;

    async function load_draft() {
      try {
        await NarrationDraft.open(post_uid, audio_url);
      } catch (error) {
        if (cancelled) {
          return;
        }

        Alert.alert(
          'Could not edit narration',
          error?.message || 'Please try again.',
          [
            {
              onPress: () => navigation.goBack(),
              text: 'OK',
            },
          ],
        );
      }
    }

    load_draft();

    return () => {
      cancelled = true;
    };
  }, [audio_url, navigation, post_uid]);

  React.useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (NarrationDraft.is_saving) {
        event.preventDefault();
        return;
      }

      if (!NarrationDraft.is_dirty) {
        NarrationDraft.discard();
        return;
      }

      event.preventDefault();
      Alert.alert(
        'Discard edits?',
        'Your edits have not been applied to this recording.',
        [
          {
            style: 'cancel',
            text: 'Keep editing',
          },
          {
            onPress: () => {
              NarrationDraft.discard();
              navigation.dispatch(event.data.action);
            },
            style: 'destructive',
            text: 'Discard',
          },
        ],
      );
    });

    return unsubscribe;
  }, [navigation, NarrationDraft.is_dirty, NarrationDraft.is_saving]);

  async function handle_save() {
    if (NarrationDraft.is_saving || NarrationDraft.is_loading) {
      return;
    }

    playback_pause_ref.current?.();

    if (!NarrationDraft.is_dirty || NarrationDraft.is_over_upload_limit()) {
      return;
    }

    try {
      await NarrationDraft.commit_local();
      navigation.goBack();
    } catch (error) {
      Alert.alert(
        'Could not apply edits',
        error?.message || 'Please try again.',
      );
    }
  }

  save_handler_ref.current = handle_save;

  const can_save = !NarrationDraft.is_loading
    && !NarrationDraft.is_saving
    && NarrationDraft.is_dirty
    && NarrationDraft.clips.length > 0
    && !NarrationDraft.is_over_upload_limit();

  React.useLayoutEffect(() => {
    if (Platform.OS === 'ios') {
      navigation.setOptions({
        gestureEnabled: !NarrationDraft.is_saving && !NarrationDraft.is_loading,
        headerLargeTitle: false,
        headerRight: undefined,
        title: 'Edit Narration',
        unstable_headerRightItems: () => [
          {
            accessibilityLabel: 'Apply narration edits',
            disabled: !can_save,
            label: 'Done',
            onPress: () => save_handler_ref.current?.(),
            type: 'button',
            variant: 'done',
          },
        ],
      });
      return;
    }

    navigation.setOptions({
      gestureEnabled: !NarrationDraft.is_saving && !NarrationDraft.is_loading,
      headerLargeTitle: false,
      title: 'Edit Narration',
      unstable_headerRightItems: undefined,
      ...header_right_element(() => (
        <HeaderPillButton
          accessibilityLabel="Apply narration edits"
          disabled={!can_save}
          label="Done"
          onPress={() => save_handler_ref.current?.()}
          theme={theme}
        />
      )),
    });
  }, [
    can_save,
    navigation,
    theme,
    NarrationDraft.is_dirty,
    NarrationDraft.is_loading,
    NarrationDraft.is_saving,
  ]);

  function toggle_playback() {
    if (playback.playing) {
      playback.pause();
    } else {
      playback.play();
    }
  }

  function handle_seek(fraction) {
    const basis = playback.total_duration > 0 ? playback.total_duration : 0;

    if (basis <= 0) {
      return;
    }

    playback.seek(fraction * basis);
  }

  function open_split(clip) {
    if (!NarrationDraft.post_uid) {
      return;
    }

    playback.pause();
    navigation.navigate('Split', {
      clip_name: clip.name,
      narration_post_uid: NarrationDraft.post_uid,
    });
  }

  function add_segment() {
    if (!NarrationDraft.post_uid) {
      return;
    }

    playback.pause();
    navigation.navigate('Record', { narration_post_uid: NarrationDraft.post_uid });
  }

  async function import_audio_file() {
    if (!NarrationDraft.post_uid || is_importing_audio) {
      return;
    }

    let selected_uri = '';

    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: 'audio/*',
      });

      if (result.canceled) {
        return;
      }

      selected_uri = `${result.assets?.[0]?.uri || ''}`.trim();

      if (!selected_uri) {
        throw new Error('That audio file could not be opened.');
      }

      playback.pause();
      set_is_importing_audio(true);
      await NarrationDraft.import_clip(selected_uri);
    } catch (error) {
      Alert.alert(
        'Could not add audio file',
        error?.message || 'Please choose another audio file and try again.',
      );
    } finally {
      if (selected_uri) {
        try {
          const selected_file = new File(selected_uri);

          if (selected_file.exists) {
            selected_file.delete();
          }
        } catch (error) {
          // The picker cache may already have removed the temporary file.
        }
      }

      set_is_importing_audio(false);
    }
  }

  async function move_clip(index, target_index) {
    const clips = clip_meta_snapshot(NarrationDraft);

    if (target_index < 0 || target_index >= clips.length) {
      return;
    }

    const [moved] = clips.splice(index, 1);
    clips.splice(target_index, 0, moved);

    await NarrationDraft.update_clips(clips);
  }

  async function reorder_clips(next_order) {
    const clips = clip_meta_snapshot(NarrationDraft);
    const current_order = clips.map(clip => clip.name);

    if (next_order.length !== current_order.length) {
      return;
    }

    const is_unchanged = next_order.every((name, index) => name === current_order[index]);

    if (is_unchanged) {
      return;
    }

    const clips_by_name = new Map(clips.map(clip => [clip.name, clip]));
    const reordered = next_order.map(name => clips_by_name.get(name)).filter(Boolean);

    if (reordered.length !== clips.length) {
      return;
    }

    await NarrationDraft.update_clips(reordered);
  }

  async function delete_clip(index) {
    const clips = clip_meta_snapshot(NarrationDraft).filter((_, clip_index) => clip_index !== index);

    await NarrationDraft.update_clips(clips);
  }

  function confirm_delete_clip(index) {
    if (NarrationDraft.clips.length <= 1) {
      Alert.alert(
        'Keep one segment',
        'Narration needs at least one segment. Delete the narration from the post instead.',
      );
      return;
    }

    Alert.alert(
      'Delete segment?',
      'This removes the segment from this narration.',
      [
        {
          style: 'cancel',
          text: 'Cancel',
        },
        {
          onPress: () => delete_clip(index),
          style: 'destructive',
          text: 'Delete',
        },
      ],
    );
  }

  if (NarrationDraft.is_loading || !NarrationDraft.post_uid) {
    return (
      <View style={[styles.screen, styles.missingScreen, { backgroundColor: theme.colors.canvas }]}>
        <ActivityIndicator color={theme.colors.accent} size="large" />
        <Text style={[styles.missingText, { color: theme.colors.ink_soft }]}>
          Preparing narration…
        </Text>
      </View>
    );
  }

  if (NarrationDraft.clips.length === 0) {
    return (
      <View style={[styles.screen, styles.missingScreen, { backgroundColor: theme.colors.canvas }]}>
        <Text style={[styles.missingText, { color: theme.colors.ink_soft }]}>
          This narration is no longer available.
        </Text>
      </View>
    );
  }

  const total_seconds = playback.total_duration > 0
    ? playback.total_duration
    : NarrationDraft.duration_seconds;
  const elapsed_label = format_duration(playback.current_time);
  const total_label = format_duration(total_seconds);
  const clip_count = NarrationDraft.clips.length;
  const segment_count_label = clip_count === 1 ? '1 segment' : `${clip_count} segments`;
  const playback_status_label = resolve_playback_status_label({
    clip_count,
    current_clip_index: playback.current_clip_index,
    current_time: playback.current_time,
    playing: playback.playing,
    total_duration: total_seconds,
  });
  const active_clip_index = resolve_active_clip_index({
    clip_count,
    current_clip_index: playback.current_clip_index,
    current_time: playback.current_time,
    playing: playback.playing,
    total_duration: total_seconds,
  });
  const audio_size_label = NarrationDraft.formatted_audio_size();
  const is_over_upload_limit = NarrationDraft.is_over_upload_limit();
  const upload_limit_message = is_over_upload_limit
    ? build_upload_size_limit_message(NarrationDraft.total_audio_size_bytes(), 'narration')
    : '';
  const hero_title = post ? post_display_title(post) : 'Narration';

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      style={[styles.screen, { backgroundColor: theme.colors.canvas }]}
    >
      <View style={styles.heroHeader}>
        <Text style={[styles.episodeTitle, { color: theme.colors.ink }]}>
          {hero_title}
        </Text>
        <Text style={[styles.episodeMeta, { color: theme.colors.ink_soft }]}>
          {segment_count_label}
          {' · '}
          {total_label}
          {' · '}
          {audio_size_label}
        </Text>
        {is_over_upload_limit ? (
          <Text style={[styles.uploadLimitWarning, { color: theme.colors.accent_strong }]}>
            {upload_limit_message}
          </Text>
        ) : null}
      </View>

      <View
        style={[
          styles.playbackPanel,
          {
            backgroundColor: theme.colors.paper,
            borderColor: theme.colors.line,
          },
        ]}
      >
        <PlaybackWaveform
          bar_area_height={PLAYBACK_WAVEFORM_HEIGHT}
          current_time={playback.current_time}
          duration_seconds={total_seconds}
          is_playing={playback.playing}
          onSeek={handle_seek}
          theme={theme}
          waveform={NarrationDraft.waveform}
        />

        <View style={styles.transportRow}>
          <PlaybackControlButton
            is_playing={playback.playing}
            onPress={toggle_playback}
            theme={theme}
          />

          <View style={styles.transportCopy}>
            <Text style={[styles.transportTime, { color: theme.colors.ink }]}>
              {elapsed_label}
              {' / '}
              {total_label}
            </Text>
            <Text style={[styles.transportStatus, { color: theme.colors.ink_soft }]}>
              {playback_status_label}
            </Text>
          </View>
        </View>
      </View>

      <View
        style={[
          styles.segmentsPanel,
          {
            backgroundColor: theme.colors.paper_alt,
            borderColor: theme.colors.line,
          },
        ]}
      >
        <SegmentList
          active_clip_index={active_clip_index}
          clips={NarrationDraft.clip_meta}
          grouped
          onDelete={confirm_delete_clip}
          onMove={move_clip}
          onReorder={reorder_clips}
          onSplit={open_split}
          theme={theme}
        />

        <View
          style={[
            styles.addSegmentActions,
            {
              backgroundColor: with_color_opacity(theme.colors.accent, theme.is_dark ? 0.14 : 0.08),
              borderTopColor: theme.colors.line,
            },
          ]}
        >
          <Pressable
            accessibilityLabel="Record another segment"
            accessibilityRole="button"
            accessibilityState={{ disabled: is_importing_audio }}
            disabled={is_importing_audio}
            onPress={add_segment}
            style={({ pressed }) => [
              styles.addSegmentRecordButton,
              pressed && !is_importing_audio ? styles.pressed : null,
              is_importing_audio ? styles.disabledRow : null,
            ]}
          >
            <PlatformSymbol
              color={theme.colors.accent_strong}
              name="microphone"
              size={21}
            />
            <Text style={[styles.addSegmentLabel, { color: theme.colors.accent_strong }]}>
              Record another segment
            </Text>
          </Pressable>

          <Pressable
            accessibilityLabel={is_importing_audio ? 'Adding audio file' : 'Add audio file'}
            accessibilityRole="button"
            accessibilityState={{ disabled: is_importing_audio }}
            disabled={is_importing_audio}
            onPress={import_audio_file}
            style={({ pressed }) => [
              styles.addAudioFileButton,
              pressed && !is_importing_audio ? styles.pressed : null,
              is_importing_audio ? styles.disabledRow : null,
            ]}
          >
            <View
              pointerEvents="none"
              style={[
                styles.addAudioFileDivider,
                { backgroundColor: with_color_opacity(theme.colors.accent, 0.25) },
              ]}
            />
            {is_importing_audio ? (
              <ActivityIndicator
                color={theme.colors.accent_strong}
                size="small"
                style={styles.addSegmentProgress}
              />
            ) : (
              <PlatformSymbol
                color={theme.colors.accent_strong}
                name="folder"
                size={23}
              />
            )}
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  addAudioFileButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'center',
    position: 'relative',
    width: 68,
  },
  addAudioFileDivider: {
    bottom: 0,
    left: 2,
    position: 'absolute',
    top: 0,
    width: 1,
  },
  addSegmentActions: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 52,
  },
  addSegmentLabel: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 19,
  },
  addSegmentProgress: {
    width: 23,
  },
  addSegmentRecordButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  content: {
    gap: 20,
    paddingBottom: 36,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  disabledRow: {
    opacity: 0.5,
  },
  episodeMeta: {
    fontSize: 15,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
    lineHeight: 20,
  },
  episodeTitle: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 29,
  },
  heroHeader: {
    gap: 6,
    paddingHorizontal: 4,
  },
  missingScreen: {
    alignItems: 'center',
    gap: 16,
    justifyContent: 'center',
    padding: 24,
  },
  missingText: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    textAlign: 'center',
  },
  playbackPanel: {
    borderCurve: 'continuous',
    borderRadius: 26,
    borderWidth: 1,
    gap: 16,
    padding: 20,
  },
  pressed: {
    opacity: 0.72,
  },
  screen: {
    flex: 1,
  },
  segmentsPanel: {
    borderCurve: 'continuous',
    borderRadius: 26,
    borderWidth: 1,
    overflow: 'hidden',
  },
  transportCopy: {
    flex: 1,
    gap: 4,
  },
  transportRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
  },
  transportStatus: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  transportTime: {
    fontSize: 17,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
    lineHeight: 22,
  },
  uploadLimitWarning: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
});

export default observer(NarrateEditScreen);
