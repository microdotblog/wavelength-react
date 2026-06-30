import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { observer } from 'mobx-react';

import PostRow from '../components/PostRow';
import Auth from '../stores/Auth';
import Episodes from '../stores/Episodes';
import Posts from '../stores/Posts';

function PostsScreen({ navigation, theme }) {
  const posts = Posts.sorted_posts();
  const destination_label = Auth.default_site || Auth.profile_url || 'your Micro.blog';

  useFocusEffect(
    React.useCallback(() => {
      Posts.refresh();
      Episodes.refresh();
    }, []),
  );

  function open_post_edit(post) {
    const post_uid = `${post?.uid || ''}`.trim();

    if (!post_uid) {
      return;
    }

    navigation.navigate('PostEdit', { post_uid });
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

  if (posts.length === 0) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.colors.canvas }]}>
        {Posts.error_message ? (
          <Text style={[styles.error, { color: theme.colors.ink_soft }]}>
            {Posts.error_message}
          </Text>
        ) : null}
        {render_empty_state()}
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      data={posts}
      keyExtractor={item => item.uid}
      ListHeaderComponent={
        Posts.error_message ? (
          <Text style={[styles.error, { color: theme.colors.ink_soft }]}>
            {Posts.error_message}
          </Text>
        ) : null
      }
      refreshControl={
        <RefreshControl
          onRefresh={() => Posts.refresh()}
          refreshing={Posts.is_loading}
          tintColor={theme.colors.accent}
        />
      }
      renderItem={({ item }) => (
        <PostRow
          onPress={() => open_post_edit(item)}
          post={item}
          theme={theme}
        />
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
    marginHorizontal: 20,
    marginTop: 18,
    padding: 18,
  },
  content: {
    gap: 10,
    paddingBottom: 36,
    paddingHorizontal: 20,
    paddingTop: 18,
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
