import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { upsample_waveform_levels } from '../lib/downsample_waveform';
import { format_duration } from '../lib/format_duration';
import { with_color_opacity } from '../theme/wavelengthTheme';

const SPARKLINE_BAR_COUNT = 32;
const SPARKLINE_HEIGHT = 20;
const MIN_BAR_HEIGHT = 2;

function build_sparkline_levels(waveform) {
  if (!Array.isArray(waveform) || waveform.length === 0) {
    return new Array(SPARKLINE_BAR_COUNT).fill(0.16);
  }

  return upsample_waveform_levels(waveform, SPARKLINE_BAR_COUNT);
}

function SegmentSparkline({ is_active, theme, waveform }) {
  const levels = build_sparkline_levels(waveform);
  const bar_color = is_active
    ? theme.colors.accent
    : with_color_opacity(theme.colors.accent, theme.is_dark ? 0.55 : 0.4);

  return (
    <View style={styles.sparkline}>
      {levels.map((level, index) => (
        <View
          key={index}
          style={[
            styles.sparkBar,
            { backgroundColor: bar_color, height: Math.max(MIN_BAR_HEIGHT, level * SPARKLINE_HEIGHT) },
          ]}
        />
      ))}
    </View>
  );
}

function SegmentRow({
  clip,
  grouped = false,
  handle,
  index,
  is_active = false,
  onDelete,
  onPress,
  readOnly = false,
  showDivider = false,
  theme,
}) {
  return (
    <View
      style={[
        styles.row,
        grouped ? styles.groupedRow : styles.cardRow,
        grouped && is_active
          ? {
              backgroundColor: with_color_opacity(theme.colors.accent, theme.is_dark ? 0.14 : 0.08),
              borderLeftColor: theme.colors.accent,
              borderLeftWidth: 3,
            }
          : null,
        grouped && showDivider
          ? { borderBottomColor: theme.colors.line, borderBottomWidth: StyleSheet.hairlineWidth }
          : null,
        grouped
          ? null
          : {
              backgroundColor: theme.colors.glass,
              borderColor: theme.colors.line,
            },
      ]}
    >
      {handle != null ? <View style={styles.reorder}>{handle}</View> : null}

      <Pressable
        accessibilityActions={
          !readOnly && onDelete
            ? [{ label: 'Delete segment', name: 'delete' }]
            : undefined
        }
        accessibilityHint={readOnly ? undefined : 'Tap to split'}
        accessibilityLabel={`Segment ${index + 1}, ${format_duration(clip.duration_seconds)}`}
        accessibilityRole={readOnly ? undefined : 'button'}
        disabled={readOnly}
        onAccessibilityAction={event => {
          if (event.nativeEvent.actionName === 'delete') {
            onDelete?.();
          }
        }}
        onPress={readOnly ? undefined : onPress}
        style={({ pressed }) => [styles.main, !readOnly && pressed ? styles.pressed : null]}
      >
        <View style={styles.leading}>
          <View style={[styles.badge, { backgroundColor: theme.colors.accent_soft }]}>
            <Text style={[styles.badgeLabel, { color: theme.colors.accent_strong }]}>
              {index + 1}
            </Text>
          </View>
          <Text style={[styles.segmentDuration, { color: theme.colors.ink }]}>
            {format_duration(clip.duration_seconds)}
          </Text>
        </View>

        <SegmentSparkline is_active={is_active} theme={theme} waveform={clip.waveform} />

        {!readOnly ? (
          <View style={[styles.splitPill, { backgroundColor: theme.colors.accent_soft }]}>
            <Text style={[styles.splitLabel, { color: theme.colors.accent_strong }]}>Split</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 10,
    height: 22,
    justifyContent: 'center',
    minWidth: 22,
    paddingHorizontal: 6,
  },
  badgeLabel: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
    lineHeight: 14,
  },
  cardRow: {
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  groupedRow: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  leading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    width: 92,
  },
  main: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 12,
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
    flexDirection: 'row',
    gap: 8,
  },
  segmentDuration: {
    fontSize: 15,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
    lineHeight: 19,
  },
  sparkBar: {
    borderRadius: 1,
    flex: 1,
  },
  sparkline: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 1,
    height: SPARKLINE_HEIGHT,
  },
  splitLabel: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
  },
  splitPill: {
    borderCurve: 'continuous',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});

export default SegmentRow;
