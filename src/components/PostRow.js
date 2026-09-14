import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { observer } from 'mobx-react';

import PlatformSymbol from './PlatformSymbol';
import {
  format_post_date,
  post_display_title,
  post_kind,
  post_kind_icon,
  post_kind_label,
  post_plain_text,
} from '../lib/micropub_posts';

function PostRow({ onPress, post, show_kind = false, theme }) {
  const summary = post_plain_text(post.content);
  const published_label = format_post_date(post.published_at);
  const title = post_display_title(post);
  const kind = post_kind(post.content);
  const kind_label = show_kind ? post_kind_label(kind) : '';
  const kind_icon = show_kind ? post_kind_icon(kind) : '';
  const accessibility_label = [title, kind_label, published_label]
    .filter(Boolean)
    .join(', ');
  const accessibility_hint = kind === 'podcast'
    ? 'Swipe left to delete. Double tap to edit.'
    : 'Swipe left to delete. Double tap to narrate.';

  return (
    <Pressable
      accessibilityHint={accessibility_hint}
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
        {published_label.length > 0 || kind_label.length > 0 ? (
          <View style={styles.meta}>
            {published_label.length > 0 ? (
              <Text style={[styles.date, { color: theme.colors.ink_soft }]}>
                {published_label}
              </Text>
            ) : null}
            {kind_label.length > 0 ? (
              <View style={styles.kindMark}>
                {kind_icon.length > 0 ? (
                  <PlatformSymbol
                    color={theme.colors.ink_soft}
                    name={kind_icon}
                    size={12}
                  />
                ) : null}
                <Text style={[styles.date, { color: theme.colors.ink_soft }]}>
                  {kind_label}
                </Text>
              </View>
            ) : null}
          </View>
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
  kindMark: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  meta: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
