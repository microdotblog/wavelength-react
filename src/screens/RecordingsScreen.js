import React from 'react';
import { Alert, FlatList, Linking, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { observer } from 'mobx-react';

import {
  discover_playback_content_padding,
  use_discover_playback_dock,
} from '../components/DiscoverPlaybackProvider';
import Discover from '../stores/Discover';
import Episodes from '../stores/Episodes';
import { use_tab_bar_bottom_offset } from '../hooks/use_tab_bar_bottom_offset';
import EpisodeRow from '../components/EpisodeRow';
import RecordControlButton from '../components/RecordControlButton';
import SegmentSwipeRow from '../components/SegmentSwipeRow';
import { show_toast } from '../lib/toast';

function RecordingsScreen({ navigation, theme }) {
  const episodes = Episodes.sorted_episodes();
  const open_swipeable_ref = React.useRef(null);
  const tab_bar_height = use_tab_bar_bottom_offset();
  const { has_active_playback } = use_discover_playback_dock() || {};
  const list_bottom_padding = discover_playback_content_padding({
    has_active_playback,
    tab_bar_height,
  });
  const [is_duplicating_episode, set_is_duplicating_episode] = React.useState(false);

  useFocusEffect(
    React.useCallback(() => {
      Episodes.refresh();

      if (!Discover.did_hydrate) {
        Discover.refresh();
      }
    }, []),
  );

  function open_record_screen() {
    navigation.navigate('Record', { auto_start: true });
  }

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

  if (episodes.length === 0) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.colors.canvas }]}>
        <View style={styles.emptyContent}>
          <View style={styles.emptyCopy}>
            <Text style={[styles.emptyTitle, { color: theme.colors.ink }]}>
              Record your first podcast
            </Text>
            <Text style={[styles.emptyBody, { color: theme.colors.ink_soft }]}>
              Tap the button to start recording. Then you can edit it and publish it to Micro.blog.
            </Text>
          </View>

          <RecordControlButton
            attention
            onPress={open_record_screen}
            theme={theme}
          />
        </View>
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={[styles.content, { paddingBottom: list_bottom_padding }]}
      contentInsetAdjustmentBehavior="automatic"
      data={episodes}
      keyExtractor={item => item.id}
      renderItem={({ item }) => (
        <SegmentSwipeRow
          on_delete={() => request_delete_episode(item)}
          on_will_open={handle_swipe_will_open}
        >
          <EpisodeRow
            episode={item}
            onMenuAction={handle_episode_menu_action}
            onPress={() => open_edit(item.id)}
            theme={theme}
          />
        </SegmentSwipeRow>
      )}
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
