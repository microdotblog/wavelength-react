import React from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { observer } from 'mobx-react';

import {
  discover_playback_content_padding,
  use_discover_playback_dock,
} from '../components/DiscoverPlaybackProvider';
import DiscoverFilterMenu, {
  build_ios_discover_filter_header_items,
  discover_is_pending,
  discover_loading_label,
} from '../components/DiscoverFilterMenu';
import DiscoverPostRow from '../components/DiscoverPostRow';
import SegmentSwipeRow from '../components/SegmentSwipeRow';
import { use_tab_bar_bottom_offset } from '../hooks/use_tab_bar_bottom_offset';
import {
  is_playable_discover_post,
  resolve_discover_post_content,
} from '../lib/discover_posts';
import { show_toast } from '../lib/toast';
import Discover from '../stores/Discover';
import { header_right_element } from '../theme/wavelengthTheme';

function empty_copy_for_filter(filter = 'discover') {
  if (filter === 'listen_later') {
    return {
      body: 'Episodes you save for later on Micro.blog will show up here.',
      title: 'Nothing saved yet',
    };
  }

  return {
    body: 'Published podcast posts from Discover will show up here.',
    title: 'No podcasts yet',
  };
}

function DiscoverScreen({ navigation, theme }) {
  const posts = Discover.visible_posts();
  const tab_bar_height = use_tab_bar_bottom_offset();
  const open_swipeable_ref = React.useRef(null);
  const [is_pull_refreshing, set_is_pull_refreshing] = React.useState(false);
  const did_hydrate = Discover.visible_did_hydrate();
  const is_loading = Discover.visible_is_loading();
  const {
    active_post_id,
    handle_play_press,
    has_active_playback,
    playback,
  } = use_discover_playback_dock() || {};

  useFocusEffect(
    React.useCallback(() => {
      Discover.refresh();
    }, []),
  );

  React.useEffect(() => {
    Discover.refresh();
  }, [Discover.selected_filter]);

  React.useLayoutEffect(() => {
    if (Platform.OS === 'ios') {
      navigation.setOptions({
        headerRight: undefined,
        unstable_headerRightItems: () => build_ios_discover_filter_header_items({
          did_hydrate: Discover.visible_did_hydrate(),
          is_loading: Discover.visible_is_loading(),
          selected_filter: Discover.selected_filter,
          spinner: (
            <ActivityIndicator
              accessibilityLabel={discover_loading_label(Discover.selected_filter)}
              color={theme.colors.accent}
              size="small"
            />
          ),
        }),
      });
      return;
    }

    navigation.setOptions({
      unstable_headerRightItems: undefined,
      ...header_right_element(() => (
        <DiscoverFilterMenu theme={theme} />
      )),
    });
  }, [
    did_hydrate,
    is_loading,
    navigation,
    theme,
    Discover.selected_filter,
  ]);

  async function handle_pull_refresh() {
    set_is_pull_refreshing(true);

    try {
      await Discover.refresh();
    } finally {
      set_is_pull_refreshing(false);
    }
  }

  function open_post(post) {
    const post_url = `${post?.url || ''}`.trim();

    if (post_url) {
      Linking.openURL(post_url);
    }
  }

  function handle_swipe_will_open(swipeable) {
    if (open_swipeable_ref.current && open_swipeable_ref.current !== swipeable) {
      open_swipeable_ref.current.close?.();
    }

    open_swipeable_ref.current = swipeable;
  }

  function confirm_remove_listen_later(post) {
    Alert.alert(
      'Remove from Listen Later?',
      'This removes the episode from your queue.',
      [
        {
          style: 'cancel',
          text: 'Cancel',
        },
        {
          onPress: () => remove_listen_later(post),
          style: 'destructive',
          text: 'Remove',
        },
      ],
    );
  }

  async function remove_listen_later(post) {
    const post_id = `${post?.id || ''}`.trim();

    if (!post_id) {
      return;
    }

    try {
      await Discover.remove_listen_later(post_id);
      show_toast('Removed from Listen Later.');
    } catch (error) {
      show_toast(error?.message || 'Could not remove that episode. Please try again.');
    }
  }

  async function save_listen_later(post) {
    const post_id = `${post?.id || ''}`.trim();

    if (!post_id) {
      return;
    }

    try {
      await Discover.save_listen_later(post_id);
      show_toast('Saved to Listen Later.');
    } catch (error) {
      show_toast(error?.message || 'Could not save that episode. Please try again.');
    }
  }

  function handle_row_menu_action(action_id, post) {
    if (action_id === 'play') {
      handle_play_press?.(post);
      return;
    }

    if (action_id === 'open') {
      open_post(post);
      return;
    }

    if (action_id === 'listen_later') {
      save_listen_later(post);
      return;
    }

    if (action_id === 'remove') {
      confirm_remove_listen_later(post);
    }
  }

  const list_bottom_padding = discover_playback_content_padding({
    has_active_playback,
    tab_bar_height,
  });

  function render_empty_state() {
    if (discover_is_pending({ did_hydrate, is_loading })) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator color={theme.colors.accent} size="large" />
        </View>
      );
    }

    const empty_copy = empty_copy_for_filter(Discover.selected_filter);

    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.paper,
            borderColor: theme.colors.line,
          },
        ]}
      >
        <Text style={[styles.title, { color: theme.colors.ink }]}>{empty_copy.title}</Text>
        <Text style={[styles.body, { color: theme.colors.ink_soft }]}>
          {empty_copy.body}
        </Text>
      </View>
    );
  }

  function render_footer() {
    if (!Discover.visible_is_loading_more()) {
      return null;
    }

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator color={theme.colors.accent} size="small" />
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={
        posts.length === 0
          ? [styles.content, styles.emptyContent, { paddingBottom: list_bottom_padding }]
          : [styles.content, { paddingBottom: list_bottom_padding }]
      }
      contentInsetAdjustmentBehavior="automatic"
      data={posts}
      extraData={Discover.selected_filter}
      keyExtractor={item => `${Discover.selected_filter}:${item.id}`}
      ListEmptyComponent={render_empty_state}
      ListFooterComponent={render_footer}
      ListHeaderComponent={
        Discover.error_message ? (
          <Text style={[styles.error, { color: theme.colors.ink_soft }]}>
            {Discover.error_message}
          </Text>
        ) : null
      }
      onEndReached={() => Discover.load_more()}
      onEndReachedThreshold={0.4}
      refreshControl={
        <RefreshControl
          onRefresh={handle_pull_refresh}
          refreshing={is_pull_refreshing}
          tintColor={theme.colors.accent}
        />
      }
      renderItem={({ item }) => {
        const row_content = resolve_discover_post_content(item);
        const is_playable = is_playable_discover_post(item);
        const is_active = active_post_id === item.id;
        const row = (
          <DiscoverPostRow
            accessibility_label={`Open ${row_content.display_title}`}
            avatar_url={item.author_avatar}
            display_title={row_content.display_title}
            is_active={is_active}
            is_buffering={is_active && playback?.is_buffering}
            is_playable={is_playable}
            is_playing={is_active && playback?.playing}
            is_saved={item.is_saved || Discover.is_listen_later()}
            on_menu_action={action_id => handle_row_menu_action(action_id, item)}
            on_play_press={() => handle_play_press?.(item)}
            onPress={() => open_post(item)}
            secondary_source_label={row_content.secondary_source_label}
            source_label={row_content.source_label}
            summary={row_content.summary}
            theme={theme}
            timestamp={row_content.timestamp}
          />
        );

        if (!Discover.is_listen_later()) {
          return row;
        }

        return (
          <SegmentSwipeRow
            on_delete={() => confirm_remove_listen_later(item)}
            on_will_open={handle_swipe_will_open}
          >
            {row}
          </SegmentSwipeRow>
        );
      }}
      style={[styles.screen, { backgroundColor: theme.colors.canvas }]}
    />
  );
}

const styles = StyleSheet.create({
  body: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 23,
  },
  card: {
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    padding: 18,
  },
  content: {
    gap: 10,
    paddingBottom: 36,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  emptyContent: {
    flexGrow: 1,
  },
  emptyState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  error: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    marginBottom: 8,
  },
  footerLoader: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  screen: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 26,
  },
});

export default observer(DiscoverScreen);
