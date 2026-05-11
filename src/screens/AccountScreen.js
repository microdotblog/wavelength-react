import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { observer } from 'mobx-react';

import Auth from '../stores/Auth';

function AccountScreen({ theme }) {
  const profile = Auth.current_profile();
  const username_label = profile.username ? `@${profile.username}` : 'Micro.blog';
  const site_label = profile.default_site || profile.url || 'No site returned';

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      style={[styles.screen, { backgroundColor: theme.colors.canvas }]}
    >
      <View
        style={[
          styles.group,
          {
            backgroundColor: theme.colors.paper,
            borderColor: theme.colors.line,
          },
        ]}
      >
        <AccountRow label="Username" theme={theme} value={username_label} />
        <AccountRow label="Site" theme={theme} value={site_label} />
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={Auth.sign_out}
        style={({ pressed }) => [
          styles.signOutButton,
          {
            backgroundColor: theme.colors.paper,
            borderColor: theme.colors.line,
          },
          pressed ? styles.pressed : null,
        ]}
      >
        <Text style={[styles.signOutText, { color: theme.colors.accent_strong }]}>
          Sign out
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function AccountRow({ label, theme, value }) {
  return (
    <View style={[styles.row, { borderBottomColor: theme.colors.line }]}>
      <Text style={[styles.rowLabel, { color: theme.colors.ink_soft }]}>
        {label}
      </Text>
      <Text selectable style={[styles.rowValue, { color: theme.colors.ink }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 18,
    paddingBottom: 36,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  group: {
    borderCurve: 'continuous',
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.72,
  },
  row: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowLabel: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
  },
  rowValue: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 23,
  },
  screen: {
    flex: 1,
  },
  signOutButton: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 20,
  },
});

export default observer(AccountScreen);
