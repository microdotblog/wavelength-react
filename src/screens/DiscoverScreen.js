import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { observer } from 'mobx-react';

import DiscoverPostRow from '../components/DiscoverPostRow';
import { resolve_discover_post_content } from '../lib/discover_posts';
import Discover from '../stores/Discover';

function DiscoverScreen({ theme }) {
  const posts = Discover.sorted_posts();
  const [is_pull_refreshing, set_is_pull_refreshing] = React.useState(false);

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
    <FlatList
      contentContainerStyle={
        posts.length === 0
          ? [styles.content, styles.emptyContent]
          : styles.content
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

        return (
          <DiscoverPostRow
            accessibility_label={`Open ${row_content.display_title}`}
            avatar_url={item.author_avatar}
            display_title={row_content.display_title}
            onPress={() => open_post(item)}
            secondary_source_label={row_content.secondary_source_label}
            source_label={row_content.source_label}
            summary={row_content.summary}
            theme={theme}
            timestamp={row_content.timestamp}
          />
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
