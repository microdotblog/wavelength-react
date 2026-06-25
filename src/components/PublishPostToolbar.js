import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { observer } from 'mobx-react';

import PlatformSymbol from './PlatformSymbol';
import Publishing from '../stores/Publishing';
import { DEFAULT_MAX_POST_LENGTH } from '../lib/publish_editor';

function ToolbarIconButton({ accessibility_label = '', icon_name = '', onPress, theme }) {
  return (
    <Pressable
      accessibilityLabel={accessibility_label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        pressed ? styles.pressed : null,
      ]}
    >
      <PlatformSymbol
        color={theme.colors.ink}
        name={icon_name}
        size={icon_name === 'link' ? 20 : 18}
      />
    </Pressable>
  );
}

function PublishPostToolbar({ navigation, theme }) {
  const toolbar_background = theme.is_dark ? 'rgba(55, 65, 81, 0.92)' : 'rgba(255, 255, 255, 0.9)';
  const toolbar_border = theme.is_dark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(31, 41, 55, 0.12)';
  const content_length = Publishing.post_text_length();
  const is_over_limit = content_length > DEFAULT_MAX_POST_LENGTH;
  const show_counter = !Publishing.should_show_title();

  return (
    <View style={styles.wrap}>
      {show_counter ? (
        <Text
          style={[
            styles.counter,
            {
              backgroundColor: theme.is_dark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(31, 41, 55, 0.06)',
              color: theme.colors.ink_soft,
            },
          ]}
        >
          <Text style={{ color: is_over_limit ? '#a94442' : theme.colors.ink }}>
            {content_length}
          </Text>
          /{DEFAULT_MAX_POST_LENGTH}
        </Text>
      ) : null}

      <View style={styles.row}>
        <View
          style={[
            styles.toolbarPill,
            styles.shadow,
            {
              backgroundColor: toolbar_background,
              borderColor: toolbar_border,
            },
          ]}
        >
          <ScrollView
            contentContainerStyle={styles.toolbarContent}
            horizontal
            keyboardShouldPersistTaps="always"
            showsHorizontalScrollIndicator={false}
          >
            <ToolbarIconButton
              accessibility_label="Bold"
              icon_name="bold"
              onPress={() => Publishing.handle_text_action('bold')}
              theme={theme}
            />
            <ToolbarIconButton
              accessibility_label="Italic"
              icon_name="italic"
              onPress={() => Publishing.handle_text_action('italic')}
              theme={theme}
            />
            <ToolbarIconButton
              accessibility_label="Link"
              icon_name="link"
              onPress={() => Publishing.handle_text_action('link')}
              theme={theme}
            />
            <ToolbarIconButton
              accessibility_label="Quote"
              icon_name="quote"
              onPress={() => Publishing.handle_text_action('quote')}
              theme={theme}
            />
          </ScrollView>
        </View>

        <Pressable
          accessibilityLabel="Post options"
          accessibilityRole="button"
          onPress={() => navigation.navigate('PublishOptions')}
          style={({ pressed }) => [
            styles.settingsPill,
            styles.shadow,
            {
              backgroundColor: toolbar_background,
              borderColor: toolbar_border,
            },
            pressed ? styles.pressed : null,
          ]}
        >
          <PlatformSymbol
            color={theme.colors.ink}
            name="settings"
            size={22}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  counter: {
    alignSelf: 'flex-end',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    marginBottom: 4,
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 34,
    paddingHorizontal: 4,
  },
  pressed: {
    opacity: 0.72,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  settingsPill: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    height: 42,
    justifyContent: 'center',
    marginLeft: 5,
    width: 42,
  },
  shadow: Platform.select({
    android: {
      elevation: 3,
    },
    default: {},
    ios: {
      shadowColor: '#000',
      shadowOffset: { height: 4, width: 0 },
      shadowOpacity: 0.1,
      shadowRadius: 14,
    },
  }),
  toolbarContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
    minHeight: 42,
    paddingHorizontal: 8,
  },
  toolbarPill: {
    borderCurve: 'continuous',
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    minHeight: 42,
  },
  wrap: {
    position: 'relative',
  },
});

export default observer(PublishPostToolbar);