import React from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { observer } from 'mobx-react';

import Episodes from '../stores/Episodes';
import DeleteEpisodeModal from '../components/DeleteEpisodeModal';
import EpisodeRow from '../components/EpisodeRow';
import RecordControlButton from '../components/RecordControlButton';
import { show_toast } from '../lib/toast';

function RecordingsScreen({ navigation, theme }) {
  const episodes = Episodes.sorted_episodes();
  const [delete_episode, set_delete_episode] = React.useState(null);
  const [is_deleting_episode, set_is_deleting_episode] = React.useState(false);
  const [is_duplicating_episode, set_is_duplicating_episode] = React.useState(false);

  useFocusEffect(
    React.useCallback(() => {
      Episodes.refresh();
    }, []),
  );

  function open_record_screen() {
    navigation.navigate('Record', { auto_start: true });
  }

  function open_edit(episode_id, extra_params = {}) {
    navigation.navigate('Edit', { episode_id, ...extra_params });
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
        set_delete_episode(episode);
        return;
      default:
        break;
    }
  }

  async function handle_delete_episode(delete_post = false) {
    if (!delete_episode) {
      return;
    }

    set_is_deleting_episode(true);

    try {
      await Episodes.delete_episode(delete_episode.id, { delete_post });
      set_delete_episode(null);
      show_toast(
        delete_post
          ? 'Episode and post deleted.'
          : (delete_episode.is_published() ? 'Episode removed from device.' : 'Episode deleted.'),
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
              Record your first microcast
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
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        style={[styles.screen, { backgroundColor: theme.colors.canvas }]}
      >
        <View style={styles.episodesSection}>
          <Text style={[styles.sectionTitle, { color: theme.colors.ink }]}>
            Episodes
          </Text>
          <View style={styles.episodesList}>
            {episodes.map(episode => (
              <EpisodeRow
                episode={episode}
                key={episode.id}
                onMenuAction={handle_episode_menu_action}
                onPress={() => open_edit(episode.id)}
                theme={theme}
              />
            ))}
          </View>
        </View>
      </ScrollView>

      <DeleteEpisodeModal
        episode_title={delete_episode?.title || ''}
        has_published_post={delete_episode?.is_published?.() ?? false}
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
    gap: 18,
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
  episodesList: {
    gap: 10,
  },
  episodesSection: {
    gap: 12,
  },
  screen: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 23,
  },
});

export default observer(RecordingsScreen);
