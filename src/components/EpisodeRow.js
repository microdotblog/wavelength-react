import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { observer } from 'mobx-react';

import { format_duration } from '../lib/format_duration';

function EpisodeRow({ episode, onPress, theme }) {
  const is_published = episode.is_published();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: theme.colors.glass,
          borderColor: theme.colors.line,
        },
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Text numberOfLines={1} style={[styles.title, { color: theme.colors.ink }]}>
            {episode.title}
          </Text>
          {is_published ? (
            <View style={[styles.badge, { backgroundColor: theme.colors.accent_soft }]}>
              <Text style={[styles.badgeLabel, { color: theme.colors.accent_strong }]}>
                Published
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.duration, { color: theme.colors.ink_soft }]}>
          {format_duration(episode.duration_seconds)}
        </Text>
      </View>
      <Text style={[styles.chevron, { color: theme.colors.ink_soft }]}>
        ›
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderCurve: 'continuous',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
    lineHeight: 14,
    textTransform: 'uppercase',
  },
  chevron: {
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 28,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  duration: {
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.72,
  },
  row: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 68,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
});

export default observer(EpisodeRow);
