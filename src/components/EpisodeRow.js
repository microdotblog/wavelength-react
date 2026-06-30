import React from 'react';
import { MenuView } from '@react-native-menu/menu';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { observer } from 'mobx-react';

import { format_duration } from '../lib/format_duration';

const DESTRUCTIVE_MENU_ICON_COLOR = '#ef4444';

function ios_menu_action({ destructive = false, id, image, theme, title }) {
  const action = { id, title };

  if (Platform.OS === 'ios') {
    action.image = image;
    action.imageColor = destructive ? DESTRUCTIVE_MENU_ICON_COLOR : theme.colors.ink;
  }

  if (destructive) {
    action.attributes = { destructive: true };
  }

  return action;
}

function build_menu_actions(episode, theme) {
  const is_published = episode.is_published();
  const post_url = `${episode.post_url || ''}`.trim();
  const post_id = `${episode.post_id || ''}`.trim();
  const actions = [
    ios_menu_action({ id: 'listen', image: 'play.fill', theme, title: 'Listen' }),
  ];

  if (!is_published) {
    actions.push(
      ios_menu_action({ id: 'publish', image: 'paperplane.fill', theme, title: 'Publish' }),
    );
  }

  if (is_published && post_url.length > 0) {
    actions.push(
      ios_menu_action({ id: 'view_post', image: 'safari', theme, title: 'View Post' }),
    );
  }

  if (is_published && post_id.length > 0) {
    actions.push(
      ios_menu_action({ id: 'edit_post', image: 'square.and.pencil', theme, title: 'Edit Post' }),
    );
  }

  actions.push(
    ios_menu_action({ id: 'rename', image: 'pencil', theme, title: 'Rename' }),
  );

  if (is_published) {
    actions.push(
      ios_menu_action({ id: 'duplicate', image: 'plus.square.on.square', theme, title: 'Duplicate' }),
    );
  }

  actions.push(
    ios_menu_action({
      destructive: true,
      id: 'delete',
      image: 'trash',
      theme,
      title: 'Delete Episode',
    }),
  );

  return actions;
}

function EpisodeRow({ episode, onMenuAction, onPress, theme }) {
  const is_published = episode.is_published();

  function handle_press_action({ nativeEvent }) {
    onMenuAction?.(nativeEvent.event, episode);
  }

  const row_content = (
    <View style={styles.content}>
      <View style={styles.copy}>
        <Text numberOfLines={1} style={[styles.title, { color: theme.colors.ink }]}>
          {episode.title}
        </Text>
        <Text style={[styles.meta, { color: theme.colors.ink_soft }]}>
          {format_duration(episode.duration_seconds)}
          {is_published ? (
            <>
              {' · '}
              <Text style={[styles.publishedMeta, { color: theme.colors.accent_strong }]}>
                Published
              </Text>
            </>
          ) : null}
        </Text>
      </View>
      <Text style={[styles.chevron, { color: theme.colors.ink_soft }]}>
        ›
      </Text>
    </View>
  );

  return (
    <Pressable
      accessibilityHint="Long press for episode actions. Swipe left to delete."
      accessibilityLabel={episode.title}
      accessibilityRole="button"
      onLongPress={() => {}}
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
      <MenuView
        actions={build_menu_actions(episode, theme)}
        onPressAction={handle_press_action}
        shouldOpenOnLongPress
        themeVariant={theme.is_dark ? 'dark' : 'light'}
      >
        {row_content}
      </MenuView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chevron: {
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 28,
  },
  content: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  copy: {
    flex: 1,
    flexShrink: 1,
    gap: 4,
    minWidth: 0,
  },
  meta: {
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
    lineHeight: 18,
  },
  publishedMeta: {
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.72,
  },
  row: {
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    minHeight: 68,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
  },
});

export default observer(EpisodeRow);
