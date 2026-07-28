import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { observer } from 'mobx-react';

import { format_post_date, post_plain_text } from '../lib/micropub_posts';

function PostRow({ onPress, post, theme }) {
  const summary = post_plain_text(post.content);
  const published_label = format_post_date(post.published_at);
  const title = `${post.title || ''}`.trim() || 'Podcast';
  const accessibility_label = published_label.length > 0
    ? `${title}, ${published_label}`
    : title;

  return (
    <Pressable
      accessibilityHint="Swipe left to delete. Double tap to edit."
      accessibilityLabel={accessibility_label}
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
        <Text numberOfLines={1} style={[styles.title, { color: theme.colors.ink }]}>
          {title}
        </Text>
        {summary.length > 0 ? (
          <Text numberOfLines={2} style={[styles.summary, { color: theme.colors.ink_soft }]}>
            {summary}
          </Text>
        ) : null}
        {published_label.length > 0 ? (
          <Text style={[styles.date, { color: theme.colors.ink_soft }]}>
            {published_label}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.chevron, { color: theme.colors.ink_soft }]}>
        ›
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chevron: {
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 28,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  date: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 17,
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
  summary: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
  },
});

export default observer(PostRow);
