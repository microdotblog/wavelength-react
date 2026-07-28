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
import DeleteEpisodeModal from '../components/DeleteEpisodeModal';
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
  const [delete_episode, set_delete_episode] = React.useState(null);
  const [is_deleting_episode, set_is_deleting_episode] = React.useState(false);
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
    set_delete_episode({
      id: episode.id,
      is_published: episode.is_published(),
      title: episode.title,
    });
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

  async function handle_delete_episode(delete_post = false) {
    if (!delete_episode) {
      return;
    }

    const { id, is_published } = delete_episode;

    set_is_deleting_episode(true);

    try {
      await Episodes.delete_episode(id, { delete_post });
      set_delete_episode(null);
      show_toast(
        delete_post
          ? 'Episode and post deleted.'
          : (is_published ? 'Episode removed from device.' : 'Episode deleted.'),
      );
    } catch (error) {
      show_toast(error?.message || 'Could not delete episode. Please try again.');
    } finally {
      set_is_deleting_episode(false);
    }
  }

  function close_delete_modal() {
    if (is_deleting_episode) {
      return;
    }

    set_delete_episode(null);
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
              Tap the button to start recording. We'll help you edit it and publish to Micro.blog.
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
    <>
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

      <DeleteEpisodeModal
        episode_title={delete_episode?.title || ''}
        has_published_post={delete_episode?.is_published ?? false}
        is_busy={is_deleting_episode}
        on_cancel={close_delete_modal}
        on_delete_device_and_post={() => handle_delete_episode(true)}
        on_delete_device_only={() => handle_delete_episode(false)}
        theme={theme}
        visible={delete_episode != null}
      />
    </>
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
