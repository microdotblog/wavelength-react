import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';
import { observer } from 'mobx-react';

import Auth from '../stores/Auth';
import Episodes from '../stores/Episodes';
import EpisodeRow from '../components/EpisodeRow';
import { with_color_opacity } from '../theme/wavelengthTheme';

const WAVELENGTH_ICON = require('../../assets/icon.png');

function StudioScreen({ navigation, theme }) {
  const profile = Auth.current_profile();
  const username_label = profile.username ? `@${profile.username}` : 'Micro.blog';
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
      <View
        style={[
          styles.heroPanel,
          {
            backgroundColor: theme.colors.paper,
            borderColor: theme.colors.line,
            boxShadow: theme.is_dark
              ? '0 12px 22px rgba(0, 0, 0, 0.36)'
              : '0 12px 22px rgba(95, 53, 0, 0.12)',
          },
        ]}
      >
        <View style={styles.heroHeader}>
          <Image source={WAVELENGTH_ICON} style={styles.heroIcon} />
          <View style={styles.heroCopy}>
            <Text style={[styles.heroEyebrow, { color: theme.colors.accent_strong }]}>
              Signed in as
            </Text>
            <Text selectable style={[styles.heroTitle, { color: theme.colors.ink }]}>
              {username_label}
            </Text>
          </View>
        </View>
        <Text style={[styles.heroBody, { color: theme.colors.ink_soft }]}>
          Your Wavelength studio is connected to Micro.blog and ready for microcasts.
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.navigate('Record')}
        style={({ pressed }) => [
          styles.recordAction,
          {
            backgroundColor: theme.colors.accent,
            boxShadow: theme.is_dark
              ? '0 10px 18px rgba(0, 0, 0, 0.28)'
              : '0 10px 18px rgba(95, 53, 0, 0.18)',
          },
          pressed ? styles.pressed : null,
        ]}
      >
        <Text style={[styles.recordActionText, { color: theme.colors.button_text }]}>
          New Recording
        </Text>
      </Pressable>

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

      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.navigate('Account')}
        style={({ pressed }) => [
          styles.accountButton,
          {
            backgroundColor: with_color_opacity(theme.colors.accent, theme.is_dark ? 0.18 : 0.12),
            borderColor: theme.colors.line,
          },
          pressed ? styles.pressed : null,
        ]}
      >
        <Text style={[styles.accountButtonText, { color: theme.colors.accent_strong }]}>
          Account
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  accountButton: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 18,
  },
  accountButtonText: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 20,
  },
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
  heroBody: {
    fontSize: 16,
    lineHeight: 24,
  },
  heroCopy: {
    flex: 1,
    gap: 2,
  },
  heroEyebrow: {
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  heroHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  heroIcon: {
    borderRadius: 24,
    height: 56,
    width: 56,
  },
  heroPanel: {
    borderCurve: 'continuous',
    borderRadius: 26,
    borderWidth: 1,
    gap: 18,
    padding: 18,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 31,
  },
  pressed: {
    opacity: 0.72,
  },
  recordAction: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 20,
    justifyContent: 'center',
    minHeight: 58,
    paddingHorizontal: 18,
  },
  recordActionText: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
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

export default observer(StudioScreen);
