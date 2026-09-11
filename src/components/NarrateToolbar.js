import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { observer } from 'mobx-react';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import PlatformSymbol from './PlatformSymbol';
import PlaybackProgressBar from './PlaybackProgressBar';
import PlaybackWaveform from './PlaybackWaveform';
import RecordPulseRings from './RecordPulseRings';
import RecordingWaveform from './RecordingWaveform';
import { format_duration } from '../lib/format_duration';
import { WAVELENGTH_GOLD, with_color_opacity } from '../theme/wavelengthTheme';

const CONTROL_SIZE = 40;
const RECORDING_WAVEFORM_HEIGHT = 44;
const COMPACT_PULSE_EXTRA = 0.4;
const ENTICE_DURATION_MS = 7200;
const ENTICE_FADE_MS = 480;
const CHIP_LAYOUT_MS = 280;
const CHIP_ENTER_MS = 200;
const CHIP_LAYOUT = LinearTransition.duration(CHIP_LAYOUT_MS).easing(Easing.inOut(Easing.quad));
const CHIP_ENTER = FadeIn.duration(CHIP_ENTER_MS);

function narrate_chip_surface(theme) {
  if (theme.is_dark) {
    return {
      backgroundColor: 'rgba(55, 65, 81, 0.92)',
      borderColor: 'rgba(255, 255, 255, 0.12)',
      experimental_backgroundImage: `linear-gradient(165deg, rgba(255, 255, 255, 0.08) 0%, rgba(55, 65, 81, 0) 48%, ${with_color_opacity(theme.colors.accent, 0.12)} 100%)`,
    };
  }

  return {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderColor: 'rgba(31, 41, 55, 0.12)',
    experimental_backgroundImage: `linear-gradient(165deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 250, 240, 0.4) 50%, ${with_color_opacity(WAVELENGTH_GOLD, 0.18)} 100%)`,
  };
}

export function should_entice_narration(mode = 'idle') {
  return mode === 'idle';
}

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

function ChipEnticeGradient({ active = false, theme }) {
  const presence = useSharedValue(active ? 1 : 0);
  const shift = useSharedValue(0);

  React.useEffect(() => {
    presence.value = withTiming(active ? 1 : 0, {
      duration: ENTICE_FADE_MS,
      easing: Easing.inOut(Easing.quad),
    });

    if (!active) {
      cancelAnimation(shift);
      return () => cancelAnimation(shift);
    }

    shift.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: ENTICE_DURATION_MS,
          easing: Easing.inOut(Easing.sin),
        }),
        withTiming(0, {
          duration: ENTICE_DURATION_MS,
          easing: Easing.inOut(Easing.sin),
        }),
      ),
      -1,
      false,
    );

    return () => cancelAnimation(shift);
  }, [active, presence, shift]);

  const presence_style = useAnimatedStyle(() => ({
    opacity: presence.value * (0.42 + shift.value * 0.28),
  }));
  const wash_style = useAnimatedStyle(() => ({
    transform: [
      { translateX: -8 + shift.value * 16 },
      { translateY: -3 + shift.value * 6 },
      { scale: 1.16 },
    ],
  }));

  const highlight = theme.is_dark
    ? with_color_opacity(theme.colors.accent, 0.22)
    : with_color_opacity(WAVELENGTH_GOLD, 0.3);
  const fade = theme.is_dark ? 'rgba(0, 0, 0, 0)' : 'rgba(255, 255, 255, 0)';

  return (
    <Animated.View pointerEvents="none" style={[styles.enticeOverlay, presence_style]}>
      <Animated.View style={[styles.enticeFill, wash_style]}>
        <LinearGradient
          colors={[fade, highlight, fade]}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={styles.enticeFill}
        />
      </Animated.View>
    </Animated.View>
  );
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

function ModeBlock({ children }) {
  return (
    <Animated.View style={styles.modeBlock}>
      {children}
    </Animated.View>
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
  levels = [],
  metering,
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
  const is_live_recording = recording_phase === 'recording';
  let record_label = 'Start recording';

  if (recording_phase === 'recording') {
    record_label = 'Pause recording';
  } else if (recording_phase === 'paused') {
    record_label = 'Resume recording';
  }

  return (
    <Animated.View layout={CHIP_LAYOUT} style={[styles.shadowWrap, styles.shadow]}>
      <Animated.View
        layout={CHIP_LAYOUT}
        style={[
          styles.container,
          narrate_chip_surface(theme),
        ]}
      >
        <ChipEnticeGradient
          active={should_entice_narration(mode)}
          theme={theme}
        />
        {mode === 'saving' ? (
          <ModeBlock>
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
          </ModeBlock>
        ) : null}

        {mode === 'denied' ? (
          <ModeBlock>
            <Text style={[styles.status, { color: theme.colors.ink }]}>
              Microphone access is required to record narration.
            </Text>
          </ModeBlock>
        ) : null}

        {mode === 'idle' ? (
          <ModeBlock>
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
          </ModeBlock>
        ) : null}

        {mode === 'recording' ? (
          <ModeBlock>
            <View style={styles.controlsRow}>
              <View style={styles.recordButtonWrap}>
                <RecordPulseRings
                  is_recording={is_live_recording}
                  max_extra={COMPACT_PULSE_EXTRA}
                  metering={metering}
                  size={CONTROL_SIZE}
                  theme={theme}
                />
                <CompactIconButton
                  accessibilityLabel={record_label}
                  background_color={theme.colors.accent}
                  border_color={with_color_opacity(theme.colors.accent, theme.is_dark ? 0.5 : 0.35)}
                  icon_color={theme.colors.button_text}
                  icon_name={is_live_recording ? 'pause' : 'microphone'}
                  onPress={on_record_press}
                />
              </View>
              <View style={styles.waveformWrap}>
                <RecordingWaveform
                  bar_area_height={RECORDING_WAVEFORM_HEIGHT}
                  is_recording={is_live_recording}
                  levels={levels}
                  theme={theme}
                />
              </View>
            </View>
            <Animated.View entering={CHIP_ENTER} style={styles.actionsRow}>
              <Text style={[styles.timeLabel, { color: theme.colors.ink, fontVariant: ['tabular-nums'] }]}>
                {format_duration(duration_seconds)}
              </Text>
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
            </Animated.View>
          </ModeBlock>
        ) : null}

        {mode === 'review' ? (
          <ModeBlock>
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
                  bar_area_height={RECORDING_WAVEFORM_HEIGHT}
                  current_time={current_time}
                  duration_seconds={duration_seconds}
                  is_playing={is_playing}
                  onSeek={on_seek}
                  theme={theme}
                  waveform={waveform}
                />
              </View>
            </View>
            <Animated.View entering={CHIP_ENTER} style={styles.actionsRow}>
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
            </Animated.View>
          </ModeBlock>
        ) : null}

        {mode === 'remote' ? (
          <ModeBlock>
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
          </ModeBlock>
        ) : null}
      </Animated.View>
    </Animated.View>
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
    overflow: 'hidden',
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
    zIndex: 1,
  },
  controlsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  disabled: {
    opacity: 0.45,
  },
  modeBlock: {
    gap: 10,
  },
  enticeFill: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  enticeOverlay: {
    borderCurve: 'continuous',
    borderRadius: 22,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 0,
  },
  pressed: {
    opacity: 0.72,
  },
  recordButtonWrap: {
    alignItems: 'center',
    height: CONTROL_SIZE,
    justifyContent: 'center',
    width: CONTROL_SIZE,
  },
  shadow: {
    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.1)',
  },
  shadowWrap: {
    borderCurve: 'continuous',
    borderRadius: 22,
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
