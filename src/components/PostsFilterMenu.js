import React from 'react';
import { MenuView } from '@react-native-menu/menu';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { observer } from 'mobx-react';

import Posts from '../stores/Posts';
import { is_liquid_glass, with_color_opacity } from '../theme/wavelengthTheme';

export const POST_FILTER_OPTIONS = [
  { id: 'all', label: 'All' },
  { id: 'posts', label: 'Posts' },
  { id: 'podcasts', label: 'Podcasts' },
  { id: 'narrated', label: 'Narrated' },
];

export function post_filter_label(filter = 'podcasts') {
  const match = POST_FILTER_OPTIONS.find(option => option.id === filter);

  if (match) {
    return match.label;
  }

  return 'Podcasts';
}

export function build_ios_posts_filter_header_items({
  did_hydrate = false,
  is_loading = false,
  selected_filter = 'podcasts',
  spinner = null,
} = {}) {
  const items = [];

  if (!did_hydrate || is_loading) {
    items.push({
      accessibilityLabel: 'Loading posts',
      element: spinner,
      hidesSharedBackground: true,
      type: 'custom',
    });
  }

  items.push({
    accessibilityLabel: 'Filter posts',
    label: post_filter_label(selected_filter),
    menu: {
      items: POST_FILTER_OPTIONS.map(option => ({
        label: option.label,
        onPress: () => Posts.set_selected_filter(option.id),
        state: option.id === selected_filter ? 'on' : 'off',
        type: 'action',
      })),
      singleSelection: true,
      title: 'Show',
    },
    type: 'menu',
  });

  return items;
}

function PostsFilterMenu({ theme }) {
  const should_use_liquid_glass = is_liquid_glass();
  const selected_id = Posts.selected_filter;
  const selected_label = post_filter_label(selected_id);

  function handle_press_action({ nativeEvent }) {
    Posts.set_selected_filter(nativeEvent.event);
  }

  const actions = POST_FILTER_OPTIONS.map(option => ({
    id: option.id,
    state: option.id === selected_id ? 'on' : 'off',
    title: option.label,
  }));

  const show_loading_indicator = !Posts.did_hydrate || Posts.is_loading;

  return (
    <View style={styles.row}>
      {show_loading_indicator ? (
        <ActivityIndicator
          accessibilityLabel="Loading posts"
          color={theme.colors.accent}
          size="small"
          style={styles.loadingIndicator}
        />
      ) : null}
      <MenuView
        accessibilityLabel="Filter posts"
        actions={actions}
        onPressAction={handle_press_action}
        themeVariant={theme.is_dark ? 'dark' : 'light'}
      >
        <Pressable
          accessibilityHint="Opens a menu to filter posts"
          accessibilityLabel={`Filter posts, ${selected_label}`}
          accessibilityRole="button"
          style={({ pressed }) => [
            Platform.OS === 'android' ? styles.androidTrigger : styles.iosTrigger,
            Platform.OS === 'ios'
              ? {
                  backgroundColor: should_use_liquid_glass
                    ? 'transparent'
                    : with_color_opacity(theme.colors.paper, theme.is_dark ? 0.72 : 0.84),
                  borderColor: should_use_liquid_glass ? 'transparent' : theme.colors.line,
                }
              : null,
            pressed ? styles.pressed : null,
          ]}
        >
          <Text
            style={[
              Platform.OS === 'android' ? styles.androidLabel : styles.iosLabel,
              { color: theme.colors.accent_strong },
            ]}
          >
            {selected_label}
          </Text>
        </Pressable>
      </MenuView>
    </View>
  );
}

const styles = StyleSheet.create({
  androidLabel: {
    fontSize: 17,
    fontWeight: '500',
    lineHeight: 20,
  },
  androidTrigger: {
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 4,
  },
  iosLabel: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 18,
  },
  iosTrigger: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 32,
    minWidth: 58,
    paddingHorizontal: 11,
  },
  loadingIndicator: {
    height: 28,
    width: 28,
  },
  pressed: {
    opacity: 0.68,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
});

export default observer(PostsFilterMenu);
