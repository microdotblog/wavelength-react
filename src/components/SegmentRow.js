import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { format_duration } from '../lib/format_duration';
import { with_color_opacity } from '../theme/wavelengthTheme';

const MINI_BAR_COUNT = 28;
const MINI_BAR_AREA_HEIGHT = 32;
const MIN_BAR_HEIGHT = 3;

function build_mini_levels(waveform) {
  if (!Array.isArray(waveform) || waveform.length === 0) {
    return new Array(MINI_BAR_COUNT).fill(0.16);
  }

  const levels = new Array(MINI_BAR_COUNT);

  for (let index = 0; index < MINI_BAR_COUNT; index += 1) {
    const source_index = Math.min(
      waveform.length - 1,
      Math.floor((index / MINI_BAR_COUNT) * waveform.length),
    );
    levels[index] = Math.min(Math.max(waveform[source_index] || 0, 0), 1);
  }

  return levels;
}

function MiniWaveform({ color, waveform }) {
  const levels = build_mini_levels(waveform);

  return (
    <View style={styles.miniWaveform}>
      {levels.map((level, index) => (
        <View
          key={index}
          style={[
            styles.miniBar,
            { backgroundColor: color, height: Math.max(MIN_BAR_HEIGHT, level * MINI_BAR_AREA_HEIGHT) },
          ]}
        />
      ))}
    </View>
  );
}

function SegmentRow({ clip, handle, index, onDelete, onPress, theme }) {
  const mini_color = with_color_opacity(theme.colors.accent, theme.is_dark ? 0.7 : 0.55);

  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: theme.colors.glass,
          borderColor: theme.colors.line,
        },
      ]}
    >
      {handle != null ? <View style={styles.reorder}>{handle}</View> : null}

      <Pressable
        accessibilityActions={
          onDelete
            ? [{ label: 'Delete segment', name: 'delete' }]
            : undefined
        }
        accessibilityHint="Swipe left to delete, or tap to split"
        accessibilityLabel={`Segment ${index + 1}`}
        accessibilityRole="button"
        onAccessibilityAction={event => {
          if (event.nativeEvent.actionName === 'delete') {
            onDelete?.();
          }
        }}
        onPress={onPress}
        style={({ pressed }) => [styles.main, pressed ? styles.pressed : null]}
      >
        <View style={styles.mainCopy}>
          <Text style={[styles.segmentTitle, { color: theme.colors.ink }]}>
            {`Segment ${index + 1}`}
          </Text>
          <Text style={[styles.segmentMeta, { color: theme.colors.ink_soft }]}>
            {format_duration(clip.duration_seconds)}
            {'  ·  Swipe to delete'}
          </Text>
        </View>
        <MiniWaveform color={mini_color} waveform={clip.waveform} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  main: {
    flex: 1,
    gap: 8,
  },
  mainCopy: {
    gap: 3,
  },
  miniBar: {
    borderRadius: 1.5,
    flex: 1,
  },
  miniWaveform: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
    height: MINI_BAR_AREA_HEIGHT,
    width: '100%',
  },
  pressed: {
    opacity: 0.72,
  },
  reorder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 14,
  },
  segmentMeta: {
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
    lineHeight: 17,
  },
  segmentTitle: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 20,
  },
});

export default SegmentRow;
