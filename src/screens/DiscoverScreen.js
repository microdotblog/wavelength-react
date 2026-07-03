import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  LayoutAnimation,
  Linking,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { observer } from 'mobx-react';
import Animated, { Easing, FadeInDown, FadeOutDown } from 'react-native-reanimated';

import DiscoverPlaybackToolbar from '../components/DiscoverPlaybackToolbar';
import DiscoverPostRow from '../components/DiscoverPostRow';
import { use_discover_playback } from '../hooks/use_discover_playback';
import { use_tab_bar_bottom_offset } from '../hooks/use_tab_bar_bottom_offset';
import {
  is_playable_discover_post,
  resolve_discover_playback_artwork_url,
  resolve_discover_post_content,
} from '../lib/discover_posts';
import { seek_seconds_from_fraction } from '../lib/publish_editor';
import Discover from '../stores/Discover';

const PLAYBACK_DOCK_GAP = 10;
const PLAYBACK_DOCK_HEIGHT = 80;
const PLAYBACK_DOCK_ENTERING = FadeInDown.springify()
  .damping(22)
  .mass(0.75)
  .stiffness(260);
const PLAYBACK_DOCK_EXITING = FadeOutDown.duration(240).easing(Easing.in(Easing.cubic));

function DiscoverScreen({ theme }) {
  const posts = Discover.sorted_posts();
  const active_post = Discover.active_post();
  const tab_bar_height = use_tab_bar_bottom_offset();
  const [is_pull_refreshing, set_is_pull_refreshing] = React.useState(false);
  const should_play = Boolean(active_post);
  const playback_artwork_url = resolve_discover_playback_artwork_url({
    author_avatar: active_post?.author_avatar || '',
    image_url: active_post?.image_url || '',
  });

  const playback = use_discover_playback({
    artist_name: active_post?.author_name || '',
    artwork_url: playback_artwork_url,
    audio_url: active_post?.audio_url || '',
    duration_seconds: active_post?.duration_seconds || 0,
    should_play,
    title: active_post?.title || '',
  });

  useFocusEffect(
    React.useCallback(() => {
      Discover.refresh();
    }, []),
  );

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

  function handle_play_press(post) {
    if (!is_playable_discover_post(post)) {
      return;
    }

    if (Discover.active_post_id === post.id) {
      if (playback.playing || playback.is_buffering) {
        playback.pause();
      } else {
        playback.play();
      }
      return;
    }

    Discover.play_post(post.id);
  }

  function handle_toggle_playback(action = 'play') {
    if (action === 'pause') {
      playback.pause();
    } else {
      playback.play();
    }
  }

  function handle_seek(fraction = 0) {
    playback.seek(seek_seconds_from_fraction(fraction, playback.duration_seconds));
  }

  const has_active_playback = Boolean(active_post);
  const playback_dock_offset = has_active_playback
    ? tab_bar_height + PLAYBACK_DOCK_GAP
    : 0;
  const list_bottom_padding = has_active_playback
    ? tab_bar_height + PLAYBACK_DOCK_HEIGHT + PLAYBACK_DOCK_GAP + 24
    : 36;

  React.useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [has_active_playback]);

  function render_empty_state() {
    if (Discover.is_loading && !Discover.did_hydrate) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator color={theme.colors.accent} size="large" />
        </View>
      );
    }

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
        <Text style={[styles.title, { color: theme.colors.ink }]}>No microcasts yet</Text>
        <Text style={[styles.body, { color: theme.colors.ink_soft }]}>
          Published podcast posts from Discover will show up here.
        </Text>
      </View>
    );
  }

  function render_footer() {
    if (!Discover.is_loading_more) {
      return null;
    }

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator color={theme.colors.accent} size="small" />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.canvas }]}>
      <FlatList
        contentContainerStyle={
          posts.length === 0
            ? [styles.content, styles.emptyContent, { paddingBottom: list_bottom_padding }]
            : [styles.content, { paddingBottom: list_bottom_padding }]
        }
        contentInsetAdjustmentBehavior="automatic"
        data={posts}
        keyExtractor={item => item.id}
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

          const is_active = Discover.active_post_id === item.id;

          return (
            <DiscoverPostRow
              accessibility_label={`Open ${row_content.display_title}`}
              avatar_url={item.author_avatar}
              display_title={row_content.display_title}
              is_active={is_active}
              is_buffering={is_active && playback.is_buffering}
              is_playable={is_playable}
              is_playing={is_active && playback.playing}
              on_play_press={() => handle_play_press(item)}
              onPress={() => open_post(item)}
              secondary_source_label={row_content.secondary_source_label}
              source_label={row_content.source_label}
              summary={row_content.summary}
              theme={theme}
              timestamp={row_content.timestamp}
            />
          );
        }}
        style={styles.list}
      />

      {active_post ? (
        <Animated.View
          entering={PLAYBACK_DOCK_ENTERING}
          exiting={PLAYBACK_DOCK_EXITING}
          pointerEvents="box-none"
          style={[
            styles.playbackDock,
            {
              bottom: playback_dock_offset,
            },
          ]}
        >
          <DiscoverPlaybackToolbar
            artwork_url={playback_artwork_url}
            author_name={active_post.author_name}
            current_time={playback.current_time}
            duration_seconds={playback.duration_seconds}
            is_buffering={playback.is_buffering}
            is_playing={playback.playing}
            on_close={() => {
              playback.pause();
              Discover.clear_playback();
            }}
            on_open_post={() => open_post(active_post)}
            on_seek={handle_seek}
            on_toggle_playback={handle_toggle_playback}
            post_title={active_post.title}
            theme={theme}
          />
        </Animated.View>
      ) : null}
    </View>
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
  list: {
    flex: 1,
  },
  playbackDock: {
    left: 16,
    position: 'absolute',
    right: 16,
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