import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { observer } from 'mobx-react';

import Episodes from '../stores/Episodes';
import EpisodeRow from '../components/EpisodeRow';

function RecordingsScreen({ navigation, theme }) {
  const episodes = Episodes.sorted_episodes();

  useFocusEffect(
    React.useCallback(() => {
      Episodes.refresh();
    }, []),
  );

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
        {episodes.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor: theme.colors.glass,
                borderColor: theme.colors.line,
              },
            ]}
          >
            <Text style={[styles.emptyText, { color: theme.colors.ink_soft }]}>
              Record your first microcast to see it here.
            </Text>
          </View>
        ) : (
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
        )}
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
  emptyCard: {
    borderCurve: 'continuous',
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
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
