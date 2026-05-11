import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { observer } from 'mobx-react';

import Auth from '../stores/Auth';
import { with_color_opacity } from '../theme/wavelengthTheme';

const WAVELENGTH_ICON = require('../../assets/icon.png');

function StudioScreen({ navigation, theme }) {
  const profile = Auth.current_profile();
  const username_label = profile.username ? `@${profile.username}` : 'Micro.blog';

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

      <View style={styles.quickActions}>
        <StudioAction
          label="New Recording"
          note="Recorder setup comes next."
          theme={theme}
        />
        <StudioAction
          label="Episodes"
          note="No local episodes yet."
          theme={theme}
        />
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

function StudioAction({ label, note, theme }) {
  return (
    <View
      style={[
        styles.actionCard,
        {
          backgroundColor: theme.colors.glass,
          borderColor: theme.colors.line,
        },
      ]}
    >
      <Text style={[styles.actionLabel, { color: theme.colors.ink }]}>
        {label}
      </Text>
      <Text style={[styles.actionNote, { color: theme.colors.ink_soft }]}>
        {note}
      </Text>
    </View>
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
  actionCard: {
    borderCurve: 'continuous',
    borderRadius: 20,
    borderWidth: 1,
    flex: 1,
    gap: 8,
    minHeight: 118,
    minWidth: 148,
    padding: 16,
  },
  actionLabel: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
  },
  actionNote: {
    fontSize: 14,
    lineHeight: 20,
  },
  content: {
    gap: 18,
    paddingBottom: 36,
    paddingHorizontal: 20,
    paddingTop: 18,
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
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  screen: {
    flex: 1,
  },
});

export default observer(StudioScreen);
