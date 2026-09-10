import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { observer } from 'mobx-react';

import PlatformSymbol from './PlatformSymbol';
import PlaybackProgressBar from './PlaybackProgressBar';
import PlaybackWaveform from './PlaybackWaveform';
import { format_duration } from '../lib/format_duration';
import { with_color_opacity } from '../theme/wavelengthTheme';

const CONTROL_SIZE = 40;

export function resolve_narrate_toolbar_mode({
  has_remote = false,
  has_take = false,
  is_attaching = false,
  permission_status = 'granted',
  recording_phase = 'idle',
} = {}) {
  if (is_attaching) {
    return 'saving';
  }

  if (permission_status === 'denied') {
    return 'denied';
  }

  if (recording_phase === 'recording' || recording_phase === 'paused') {
    return 'recording';
  }

  if (recording_phase === 'review' || has_take) {
    return 'review';
  }

  if (has_remote) {
    return 'remote';
  }

  return 'idle';
}

function CompactIconButton({
  accessibilityLabel,
  background_color,
  border_color,
  disabled = false,
  icon_color,
  icon_name,
  onPress,
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.controlButton,
        {
          backgroundColor: background_color,
          borderColor: border_color,
          opacity: disabled ? 0.5 : 1,
        },
        pressed && !disabled ? styles.pressed : null,
      ]}
    >
      <PlatformSymbol
        color={icon_color}
        name={icon_name}
        size={14}
      />
    </Pressable>
  );
}

function TextAction({ accessibilityLabel, disabled = false, label, onPress, theme, tone = 'default' }) {
  const color = tone === 'destructive' ? theme.colors.ink_soft : theme.colors.accent_strong;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel || label}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.textAction,
        disabled ? styles.disabled : null,
        pressed && !disabled ? styles.pressed : null,
      ]}
    >
      <Text style={[styles.textActionLabel, { color }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function NarrateToolbar({
  current_time = 0,
  duration_seconds = 0,
  has_remote = false,
  has_take = false,
  is_attaching = false,
  is_playing = false,
  on_discard,
  on_finish,
  on_record_press,
  on_save,
  on_seek,
  on_toggle_playback,
  permission_status = 'granted',
  recording_phase = 'idle',
  status_label = '',
  theme,
  waveform = [],
}) {
  const mode = resolve_narrate_toolbar_mode({
    has_remote,
    has_take,
    is_attaching,
    permission_status,
    recording_phase,
  });
  const time_label = `${format_duration(current_time)} / ${format_duration(duration_seconds)}`;
  let record_label = 'Start recording';

  if (recording_phase === 'recording') {
    record_label = 'Pause recording';
  } else if (recording_phase === 'paused') {
    record_label = 'Resume recording';
  }

  return (
    <View
      style={[
        styles.container,
        styles.shadow,
        {
          backgroundColor: theme.is_dark ? 'rgba(55, 65, 81, 0.92)' : 'rgba(255, 255, 255, 0.9)',
          borderColor: theme.is_dark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(31, 41, 55, 0.12)',
        },
      ]}
    >
      {mode === 'saving' ? (
        <View style={styles.controlsRow}>
          <View
            accessibilityLabel={status_label || 'Saving narration'}
            style={[
              styles.controlButton,
              {
                backgroundColor: with_color_opacity(theme.colors.accent, theme.is_dark ? 0.18 : 0.12),
                borderColor: with_color_opacity(theme.colors.accent, theme.is_dark ? 0.5 : 0.35),
              },
            ]}
          >
            <ActivityIndicator color={theme.colors.accent} size="small" />
          </View>
          <Text style={[styles.status, { color: theme.colors.ink }]}>
            {status_label || 'Saving narration…'}
          </Text>
        </View>
      ) : null}

      {mode === 'denied' ? (
        <Text style={[styles.status, { color: theme.colors.ink }]}>
          Microphone access is required to record narration.
        </Text>
      ) : null}

      {mode === 'idle' ? (
        <View style={styles.controlsRow}>
          <CompactIconButton
            accessibilityLabel={record_label}
            background_color={theme.colors.accent}
            border_color={with_color_opacity(theme.colors.accent, theme.is_dark ? 0.5 : 0.35)}
            icon_color={theme.colors.button_text}
            icon_name="microphone"
            onPress={on_record_press}
          />
          <Text style={[styles.status, { color: theme.colors.ink }]}>
            Record narration
          </Text>
        </View>
      ) : null}

      {mode === 'recording' ? (
        <>
          <View style={styles.controlsRow}>
            <CompactIconButton
              accessibilityLabel={record_label}
              background_color={theme.colors.accent}
              border_color={with_color_opacity(theme.colors.accent, theme.is_dark ? 0.5 : 0.35)}
              icon_color={theme.colors.button_text}
              icon_name={recording_phase === 'recording' ? 'pause' : 'microphone'}
              onPress={on_record_press}
            />
            <Text style={[styles.status, { color: theme.colors.ink, fontVariant: ['tabular-nums'] }]}>
              {format_duration(duration_seconds)}
            </Text>
          </View>
          <View style={styles.actionsRow}>
            <View />
            <View style={styles.actions}>
              <TextAction
                label="Discard"
                onPress={on_discard}
                theme={theme}
                tone="destructive"
              />
              <TextAction
                label="Done"
                onPress={on_finish}
                theme={theme}
              />
            </View>
          </View>
        </>
      ) : null}

      {mode === 'review' ? (
        <>
          <View style={styles.controlsRow}>
            <CompactIconButton
              accessibilityLabel={is_playing ? 'Pause narration preview' : 'Play narration preview'}
              background_color={theme.colors.accent}
              border_color={with_color_opacity(theme.colors.accent, theme.is_dark ? 0.5 : 0.35)}
              icon_color={theme.colors.button_text}
              icon_name={is_playing ? 'pause' : 'play'}
              onPress={on_toggle_playback}
            />
            <View style={styles.waveformWrap}>
              <PlaybackWaveform
                bar_area_height={44}
                current_time={current_time}
                duration_seconds={duration_seconds}
                is_playing={is_playing}
                onSeek={on_seek}
                theme={theme}
                waveform={waveform}
              />
            </View>
          </View>
          <View style={styles.actionsRow}>
            <Text style={[styles.timeLabel, { color: theme.colors.ink_soft }]}>
              {time_label}
            </Text>
            <View style={styles.actions}>
              <TextAction
                label="Discard"
                onPress={on_discard}
                theme={theme}
                tone="destructive"
              />
              <TextAction
                label="Save"
                onPress={on_save}
                theme={theme}
              />
            </View>
          </View>
        </>
      ) : null}

      {mode === 'remote' ? (
        <View style={styles.controlsRow}>
          <CompactIconButton
            accessibilityLabel={is_playing ? 'Pause narration' : 'Play narration'}
            background_color={theme.colors.accent}
            border_color={with_color_opacity(theme.colors.accent, theme.is_dark ? 0.5 : 0.35)}
            icon_color={theme.colors.button_text}
            icon_name={is_playing ? 'pause' : 'play'}
            onPress={on_toggle_playback}
          />
          <View style={styles.waveformWrap}>
            <PlaybackProgressBar
              current_time={current_time}
              duration_seconds={duration_seconds}
              is_playing={is_playing}
              onSeek={on_seek}
              theme={theme}
            />
          </View>
          <CompactIconButton
            accessibilityLabel="Start recording"
            background_color={with_color_opacity(theme.colors.accent, theme.is_dark ? 0.18 : 0.12)}
            border_color={theme.colors.accent}
            icon_color={theme.colors.accent}
            icon_name="microphone"
            onPress={on_record_press}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: 16,
  },
  actionsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  container: {
    borderCurve: 'continuous',
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  controlButton: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: CONTROL_SIZE / 2,
    borderWidth: 2,
    height: CONTROL_SIZE,
    justifyContent: 'center',
    width: CONTROL_SIZE,
  },
  controlsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.72,
  },
  shadow: {
    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.1)',
  },
  status: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  textAction: {
    minHeight: 32,
    justifyContent: 'center',
  },
  textActionLabel: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 18,
  },
  timeLabel: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  waveformWrap: {
    flex: 1,
  },
});

export default observer(NarrateToolbar);
