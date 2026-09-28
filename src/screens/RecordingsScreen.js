import React from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { observer } from 'mobx-react';

import {
  discover_playback_content_padding,
  PLAYBACK_DOCK_GAP,
  PLAYBACK_DOCK_HEIGHT,
  use_discover_playback_dock,
} from '../components/DiscoverPlaybackProvider';
import EpisodeRow from '../components/EpisodeRow';
import PostRow from '../components/PostRow';
import RecordControlButton from '../components/RecordControlButton';
import RecordingsFilterMenu, {
  build_ios_recordings_filter_header_items,
} from '../components/RecordingsFilterMenu';
import SegmentSwipeRow from '../components/SegmentSwipeRow';
import { use_stack_top_inset } from '../hooks/use_stack_top_inset';
import { use_tab_bar_bottom_offset } from '../hooks/use_tab_bar_bottom_offset';
import { post_display_summary } from '../lib/micropub_posts';
import {
  build_recording_items,
  recordings_empty_copy,
  recordings_list_status,
} from '../lib/recordings_filter';
import { show_toast } from '../lib/toast';
import Discover from '../stores/Discover';
import Episodes from '../stores/Episodes';
import Posts from '../stores/Posts';
import { header_right_element, is_liquid_glass } from '../theme/wavelengthTheme';

function episode_post_summary(episode) {
  const post_id = `${episode?.post_id || ''}`.trim();
  const post_url = `${episode?.post_url || ''}`.trim();
  const post = Posts.get_post(post_id)
    || (post_url
      ? Posts.sorted_posts().find(item => item.url === post_url)
      : null);

  if (!post) {
    return '';
  }

  return post_display_summary(post);
}

function RecordingsScreen({ navigation, theme }) {
  const selected_filter = Episodes.selected_filter;
  const list_status = recordings_list_status({
    episodes_did_hydrate: Episodes.did_hydrate,
    episodes_is_loading: Episodes.is_loading,
    filter: selected_filter,
    posts_did_hydrate: Posts.did_hydrate,
    posts_error_message: Posts.error_message,
    posts_is_loading: Posts.is_loading,
  });
  const items = build_recording_items({
    episodes: Episodes.sorted_episodes(),
    filter: selected_filter,
    posts: Posts.sorted_posts(),
  });
  const open_swipeable_ref = React.useRef(null);
  const record_handler_ref = React.useRef(null);
  const tab_bar_height = use_tab_bar_bottom_offset();
  const { has_active_playback } = use_discover_playback_dock() || {};
  const list_bottom_padding = discover_playback_content_padding({
    has_active_playback,
    tab_bar_height,
  });
  const top_inset = use_stack_top_inset();
  const empty_bottom_inset = tab_bar_height + (
    has_active_playback ? PLAYBACK_DOCK_HEIGHT + PLAYBACK_DOCK_GAP : 0
  );
  const [is_duplicating_episode, set_is_duplicating_episode] = React.useState(false);
  const show_header_record_button = Platform.OS === 'ios' && !is_liquid_glass();

  useFocusEffect(
    React.useCallback(() => {
      Episodes.refresh();
      Posts.refresh();

      if (!Discover.did_hydrate) {
        Discover.refresh();
      }
    }, []),
  );

  React.useLayoutEffect(() => {
    if (Platform.OS === 'ios') {
      navigation.setOptions({
        headerRight: undefined,
        unstable_headerRightItems: () => build_ios_recordings_filter_header_items({
          did_hydrate: !list_status.is_loading,
          is_loading: list_status.is_loading,
          on_record: () => record_handler_ref.current?.(),
          selected_filter,
          show_record: show_header_record_button,
          spinner: (
            <ActivityIndicator
              accessibilityLabel="Loading recordings"
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
        <RecordingsFilterMenu theme={theme} />
      )),
    });
  }, [
    navigation,
    selected_filter,
    show_header_record_button,
    theme,
    list_status.is_loading,
  ]);

  function open_record_screen() {
    navigation.navigate('Record', { auto_start: true });
  }

  function open_header_record() {
    navigation.navigate('Record');
  }

  record_handler_ref.current = open_header_record;

  function open_edit(episode_id, extra_params = {}) {
    navigation.navigate('Edit', { episode_id, ...extra_params });
  }

  function handle_swipe_will_open(swipeable) {
    if (open_swipeable_ref.current && open_swipeable_ref.current !== swipeable) {
      open_swipeable_ref.current.close?.();
    }

    open_swipeable_ref.current = swipeable;
  }

  function request_delete_episode(episode) {
    const title = `${episode.title || ''}`.trim() || 'This episode';

    if (episode.is_published()) {
      Alert.alert(
        'Delete episode?',
        `"${title}" can be removed from this device while keeping its Micro.blog post, or deleted everywhere.`,
        [
          {
            style: 'cancel',
            text: 'Cancel',
          },
          {
            onPress: () => handle_delete_episode(episode, false),
            style: 'destructive',
            text: 'On device only',
          },
          {
            onPress: () => handle_delete_episode(episode, true),
            style: 'destructive',
            text: 'Everywhere',
          },
        ],
      );
    } else {
      Alert.alert(
        'Delete episode?',
        `"${title}" will be permanently removed from this device.`,
        [
          {
            style: 'cancel',
            text: 'Cancel',
          },
          {
            onPress: () => handle_delete_episode(episode, false),
            style: 'destructive',
            text: 'Delete',
          },
        ],
      );
    }
  }

  async function duplicate_episode(episode) {
    if (is_duplicating_episode) {
      return;
    }

    set_is_duplicating_episode(true);

    try {
      const duplicate_id = await Episodes.duplicate_episode(episode.id);
      open_edit(duplicate_id);
    } catch (error) {
      Alert.alert(
        'Could not duplicate episode',
        error?.message || 'Please try again.',
      );
    } finally {
      set_is_duplicating_episode(false);
    }
  }

  function handle_episode_menu_action(action_id, episode) {
    switch (action_id) {
      case 'listen':
        open_edit(episode.id, { autoplay: true });
        return;
      case 'publish':
        navigation.navigate('Publish', { episode_id: episode.id });
        return;
      case 'view_post': {
        const post_url = `${episode.post_url || ''}`.trim();

        if (post_url) {
          Linking.openURL(post_url);
        }

        return;
      }
      case 'edit_post': {
        const post_uid = `${episode.post_id || ''}`.trim();

        if (post_uid) {
          navigation.navigate('PostEdit', { episode_id: episode.id, post_uid });
        }

        return;
      }
      case 'rename':
        open_edit(episode.id, { start_rename: true });
        return;
      case 'duplicate':
        duplicate_episode(episode);
        return;
      case 'delete':
        request_delete_episode(episode);
        return;
      default:
        break;
    }
  }

  function open_narration(post) {
    const post_uid = `${post?.uid || ''}`.trim();

    if (!post_uid) {
      return;
    }

    navigation.navigate('Narrate', { post_uid });
  }

  function confirm_delete_narration(post) {
    Alert.alert(
      'Delete narration?',
      'This removes the audio from the post. The post itself stays.',
      [
        {
          style: 'cancel',
          text: 'Keep',
        },
        {
          onPress: () => delete_narration(post),
          style: 'destructive',
          text: 'Delete',
        },
      ],
    );
  }

  async function delete_narration(post) {
    const post_uid = `${post?.uid || ''}`.trim();

    if (!post_uid) {
      return;
    }

    try {
      await Posts.remove_narration(post_uid);
      show_toast('Narration deleted.');
    } catch (error) {
      show_toast(error?.message || 'Could not delete narration. Please try again.');
    }
  }

  async function handle_delete_episode(episode, delete_post = false) {
    const episode_id = episode.id;
    const was_published = episode.is_published();

    try {
      await Episodes.delete_episode(episode_id, { delete_post });
      show_toast(
        delete_post
          ? 'Episode and post deleted.'
          : (was_published ? 'Episode removed from device.' : 'Episode deleted.'),
      );
    } catch (error) {
      show_toast(error?.message || 'Could not delete episode. Please try again.');
    }
  }

  const show_empty_state = items.length === 0
    && !list_status.is_loading
    && !list_status.error_message;

  if (show_empty_state) {
    const empty_copy = recordings_empty_copy(selected_filter);

    return (
      <View
        style={[
          styles.emptyContent,
          {
            backgroundColor: theme.colors.canvas,
            paddingBottom: empty_bottom_inset,
            paddingTop: top_inset,
          },
        ]}
      >
        <View style={styles.emptyCopy}>
          <Text style={[styles.emptyTitle, { color: theme.colors.ink }]}>
            {empty_copy.title}
          </Text>
          <Text style={[styles.emptyBody, { color: theme.colors.ink_soft }]}>
            {empty_copy.body}
          </Text>
        </View>

        {empty_copy.show_record ? (
          <RecordControlButton
            attention
            onPress={open_record_screen}
            theme={theme}
          />
        ) : null}
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={[
        styles.content,
        { paddingBottom: list_bottom_padding },
      ]}
      contentInsetAdjustmentBehavior="automatic"
      data={items}
      ListHeaderComponent={
        list_status.error_message ? (
          <Text style={[styles.error, { color: theme.colors.ink_soft }]}>
            {list_status.error_message}
          </Text>
        ) : null
      }
      keyExtractor={item => item.id}
      renderItem={({ item }) => {
        if (item.kind === 'narration') {
          return (
            <SegmentSwipeRow
              on_delete={() => confirm_delete_narration(item.post)}
              on_will_open={handle_swipe_will_open}
            >
              <PostRow
                onPress={() => open_narration(item.post)}
                post={item.post}
                show_kind={selected_filter === 'all'}
                theme={theme}
              />
            </SegmentSwipeRow>
          );
        }

        return (
          <SegmentSwipeRow
            on_delete={() => request_delete_episode(item.episode)}
            on_will_open={handle_swipe_will_open}
          >
            <EpisodeRow
              episode={item.episode}
              onMenuAction={handle_episode_menu_action}
              onPress={() => open_edit(item.episode.id)}
              show_kind={selected_filter === 'all'}
              summary={episode_post_summary(item.episode)}
              theme={theme}
            />
          </SegmentSwipeRow>
        );
      }}
      style={[styles.screen, { backgroundColor: theme.colors.canvas }]}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 10,
    paddingBottom: 36,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  emptyBody: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 23,
    textAlign: 'center',
  },
  emptyContent: {
    alignItems: 'center',
    flex: 1,
    gap: 40,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyCopy: {
    alignItems: 'center',
    gap: 10,
  },
  error: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    paddingBottom: 8,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
    textAlign: 'center',
  },
  screen: {
    flex: 1,
  },
});

export default observer(RecordingsScreen);
