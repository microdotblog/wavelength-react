import React from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useScrollToTop } from '@react-navigation/native';
import { observer } from 'mobx-react';

import PostRow from '../components/PostRow';
import SegmentSwipeRow from '../components/SegmentSwipeRow';
import Auth from '../stores/Auth';
import Episodes from '../stores/Episodes';
import { show_toast } from '../lib/toast';
import Posts from '../stores/Posts';

function PostsScreen({ navigation, theme }) {
  const list_ref = React.useRef(null);
  const posts = Posts.sorted_posts();
  const destination_label = Auth.default_site || Auth.profile_url || 'your Micro.blog';
  const open_swipeable_ref = React.useRef(null);
  const [is_pull_refreshing, set_is_pull_refreshing] = React.useState(false);

  useScrollToTop(list_ref);

  useFocusEffect(
    React.useCallback(() => {
      Posts.refresh();
      Episodes.refresh();
    }, []),
  );

  async function handle_pull_refresh() {
    set_is_pull_refreshing(true);

    try {
      await Posts.refresh();
    } finally {
      set_is_pull_refreshing(false);
    }
  }

  function open_post_edit(post) {
    const post_uid = `${post?.uid || ''}`.trim();

    if (!post_uid) {
      return;
    }

    navigation.navigate('PostEdit', { post_uid });
  }

  function handle_swipe_will_open(swipeable) {
    if (open_swipeable_ref.current && open_swipeable_ref.current !== swipeable) {
      open_swipeable_ref.current.close?.();
    }

    open_swipeable_ref.current = swipeable;
  }

  function confirm_delete_post(post) {
    Alert.alert(
      'Delete post?',
      'This removes the post from Micro.blog.',
      [
        {
          style: 'cancel',
          text: 'Cancel',
        },
        {
          onPress: () => delete_post(post),
          style: 'destructive',
          text: 'Delete',
        },
      ],
    );
  }

  async function delete_post(post) {
    const post_uid = `${post?.uid || ''}`.trim();

    if (!post_uid) {
      return;
    }

    try {
      await Posts.delete_post(post_uid);

      const linked_episode = Episodes.get_episode_for_post({
        post_id: post_uid,
        post_url: `${post?.url || ''}`.trim(),
      });

      if (linked_episode) {
        await Episodes.clear_publish_link(linked_episode.id);
      }

      show_toast('Post deleted.');
    } catch (error) {
      show_toast(error?.message || 'Could not delete post. Please try again.');
    }
  }

  function render_empty_state() {
    if (Posts.is_loading && !Posts.did_hydrate) {
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
          Published audio posts from {destination_label} will show up here.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      ref={list_ref}
      contentContainerStyle={
        posts.length === 0
          ? [styles.content, styles.emptyContent]
          : styles.content
      }
      contentInsetAdjustmentBehavior="automatic"
      data={posts}
      keyExtractor={item => item.uid}
      ListEmptyComponent={render_empty_state}
      ListHeaderComponent={
        Posts.error_message ? (
          <Text style={[styles.error, { color: theme.colors.ink_soft }]}>
            {Posts.error_message}
          </Text>
        ) : null
      }
      refreshControl={
        <RefreshControl
          onRefresh={handle_pull_refresh}
          refreshing={is_pull_refreshing}
          tintColor={theme.colors.accent}
        />
      }
      renderItem={({ item }) => (
        <SegmentSwipeRow
          on_delete={() => confirm_delete_post(item)}
          on_will_open={handle_swipe_will_open}
        >
          <PostRow
            onPress={() => open_post_edit(item)}
            post={item}
            theme={theme}
          />
        </SegmentSwipeRow>
      )}
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
    paddingHorizontal: 20,
    paddingTop: 18,
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
  screen: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 26,
  },
});

export default observer(PostsScreen);
