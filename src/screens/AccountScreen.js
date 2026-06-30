import React from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { observer } from 'mobx-react';

import Auth from '../stores/Auth';
import { show_toast } from '../lib/toast';

const APP_VERSION = Constants.expoConfig?.version || '1.0.0';
const MICRO_BLOG_COMMUNITY_GUIDELINES_URL = 'https://help.micro.blog/t/community-guidelines/39';
const MICRO_BLOG_PRIVACY_POLICY_URL = 'https://help.micro.blog/t/privacy-policy/114';
const MICRO_BLOG_DELETE_ACCOUNT_URL = 'https://micro.blog/account/delete';

function AccountScreen({ theme }) {
  const profile = Auth.current_profile();
  const profile_name = `${profile.name || profile.username || ''}`.trim() || 'Micro.blog account';
  const username_label = profile.username ? `@${profile.username}` : '@micro.blog';
  const site_label = profile.default_site || profile.url || 'No site returned';
  const profile_photo = `${profile.photo || ''}`.trim();
  const avatar_initial = profile_name.charAt(0).toUpperCase() || 'M';
  const is_busy = Auth.is_loading();

  const handle_open_browser = React.useCallback(async (url, action_label) => {
    if (!url) {
      return;
    }

    try {
      await WebBrowser.openBrowserAsync(url, {
        controlsColor: theme.colors.accent,
        dismissButtonStyle: 'close',
      });
    } catch (error) {
      console.warn(`Failed to open ${action_label}`, error);
      show_toast('We could not open Micro.blog.');
    }
  }, [theme.colors.accent]);

  const handle_open_url = React.useCallback(async (url, action_label) => {
    if (!url) {
      return;
    }

    try {
      await Linking.openURL(url);
    } catch (error) {
      console.warn(`Failed to open ${action_label}`, error);
      show_toast('We could not open Micro.blog.');
    }
  }, []);

  function confirm_sign_out() {
    Alert.alert('Sign out of Wavelength?', '', [
      {
        style: 'cancel',
        text: 'Cancel',
      },
      {
        onPress: () => {
          Auth.sign_out();
        },
        style: 'destructive',
        text: 'Sign Out',
      },
    ]);
  }

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
        <View style={styles.profileRow}>
          {profile_photo ? (
            <Image
              accessibilityIgnoresInvertColors
              contentFit="cover"
              source={{ uri: profile_photo }}
              style={styles.avatar}
            />
          ) : (
            <View
              style={[
                styles.avatarFallback,
                {
                  backgroundColor: theme.colors.accent_soft,
                  borderColor: theme.colors.line,
                },
              ]}
            >
              <Text style={[styles.avatarInitial, { color: theme.colors.accent_strong }]}>
                {avatar_initial}
              </Text>
            </View>
          )}

          <View style={styles.profileMeta}>
            <Text numberOfLines={1} style={[styles.profileName, { color: theme.colors.ink }]}>
              {profile_name}
            </Text>
            <Text numberOfLines={1} style={[styles.profileHandle, { color: theme.colors.ink_soft }]}>
              {username_label}
            </Text>
          </View>
        </View>
      </View>

      <SettingsSection label="Publishing to" theme={theme}>
        <View
          style={[
            styles.group,
            {
              backgroundColor: theme.colors.paper,
              borderColor: theme.colors.line,
            },
          ]}
        >
          <Text selectable style={[styles.siteValue, { color: theme.colors.ink }]}>
            {site_label}
          </Text>
        </View>
      </SettingsSection>

      <SettingsSection label="Micro.blog" theme={theme}>
        <View
          style={[
            styles.group,
            {
              backgroundColor: theme.colors.paper,
              borderColor: theme.colors.line,
            },
          ]}
        >
          <SettingsLinkRow
            is_last={false}
            label="Community Guidelines"
            onPress={() => handle_open_browser(
              MICRO_BLOG_COMMUNITY_GUIDELINES_URL,
              'Community Guidelines',
            )}
            theme={theme}
          />
          <SettingsLinkRow
            is_last={false}
            label="Privacy Policy"
            onPress={() => handle_open_browser(
              MICRO_BLOG_PRIVACY_POLICY_URL,
              'Privacy Policy',
            )}
            theme={theme}
          />
          <SettingsLinkRow
            is_last
            label="Delete Account..."
            label_color={theme.colors.accent_strong}
            onPress={() => handle_open_url(
              MICRO_BLOG_DELETE_ACCOUNT_URL,
              'Delete Account',
            )}
            theme={theme}
          />
        </View>
      </SettingsSection>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: is_busy }}
        disabled={is_busy}
        onPress={confirm_sign_out}
        style={({ pressed }) => [
          styles.signOutButton,
          {
            backgroundColor: theme.colors.paper,
            borderColor: theme.colors.line,
          },
          is_busy ? styles.disabledButton : null,
          pressed ? styles.pressed : null,
        ]}
      >
        <Text style={[styles.signOutText, { color: theme.colors.accent_strong }]}>
          Sign Out
        </Text>
      </Pressable>

      <Text style={[styles.versionText, { color: theme.colors.ink_soft }]}>
        Wavelength {APP_VERSION}
      </Text>
    </ScrollView>
  );
}

function SettingsSection({ children, label, theme }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: theme.colors.ink_soft }]}>
        {label}
      </Text>
      {children}
    </View>
  );
}

function SettingsLinkRow({
  is_last = false,
  label,
  label_color = null,
  onPress,
  theme,
}) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      style={({ pressed }) => [
        styles.linkRow,
        !is_last ? { borderBottomColor: theme.colors.line } : null,
        !is_last ? styles.linkRowBorder : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <Text style={[styles.linkLabel, { color: label_color || theme.colors.ink }]}>
        {label}
      </Text>
      <Text style={[styles.chevron, { color: theme.colors.ink_soft }]}>
        ›
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  avatar: {
    borderCurve: 'continuous',
    borderRadius: 24,
    height: 48,
    width: 48,
  },
  avatarFallback: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 24,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 22,
  },
  chevron: {
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 28,
  },
  content: {
    gap: 18,
    paddingBottom: 36,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  disabledButton: {
    opacity: 0.58,
  },
  group: {
    borderCurve: 'continuous',
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
  },
  linkLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 21,
  },
  linkRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  linkRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pressed: {
    opacity: 0.72,
  },
  profileHandle: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  profileMeta: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },
  profileRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  screen: {
    flex: 1,
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
    lineHeight: 17,
    paddingHorizontal: 4,
    textTransform: 'uppercase',
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
  siteValue: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  versionText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 17,
    textAlign: 'center',
  },
});

export default observer(AccountScreen);
