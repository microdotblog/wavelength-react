import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { observer } from 'mobx-react';

import Episodes from '../stores/Episodes';
import EpisodeRow from '../components/EpisodeRow';
import RecordControlButton from '../components/RecordControlButton';

function RecordingsScreen({ navigation, theme }) {
  const episodes = Episodes.sorted_episodes();

  useFocusEffect(
    React.useCallback(() => {
      Episodes.refresh();
    }, []),
  );

  function open_record_screen() {
    navigation.navigate('Record', { auto_start: true });
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
              onPress={() => navigation.navigate('Edit', { episode_id: episode.id })}
              theme={theme}
            />
          ))}
        </View>
      </View>
    </ScrollView>
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
