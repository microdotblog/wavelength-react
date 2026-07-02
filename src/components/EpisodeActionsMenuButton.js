import React from 'react';
import { MenuView } from '@react-native-menu/menu';
import { Platform, Pressable, StyleSheet } from 'react-native';
import { SFSymbol } from 'react-native-sfsymbols';

import { is_liquid_glass, with_color_opacity } from '../theme/wavelengthTheme';

function EpisodeActionsMenuButton({ is_published = false, on_delete, on_duplicate, on_rename, theme }) {
  const should_use_liquid_glass = is_liquid_glass();

  function handle_press_action({ nativeEvent }) {
    const action_id = nativeEvent.event;

    if (action_id === 'rename') {
      on_rename();
      return;
    }

    if (action_id === 'duplicate') {
      on_duplicate?.();
      return;
    }

    if (action_id === 'delete') {
      on_delete();
    }
  }

  const actions = [
    { id: 'rename', title: 'Rename' },
  ];

  if (is_published) {
    actions.push({ id: 'duplicate', title: 'Duplicate' });
  }

  actions.push({
    attributes: { destructive: true },
    id: 'delete',
    title: 'Delete Episode',
  });

  function render_trigger_icon() {
    if (Platform.OS === 'android') {
      const { MaterialIcons } = require('@expo/vector-icons');

      return (
        <MaterialIcons
          color={theme.colors.ink}
          name="more-vert"
          size={24}
        />
      );
    }

    return (
      <SFSymbol
        color={theme.colors.accent_strong}
        name="ellipsis"
        style={styles.iosIcon}
      />
    );
  }

  return (
    <MenuView
      accessibilityLabel="Episode actions"
      actions={actions}
      onPressAction={handle_press_action}
      themeVariant={theme.is_dark ? 'dark' : 'light'}
    >
      <Pressable
        accessibilityLabel="Episode actions"
        accessibilityRole="button"
        style={({ pressed }) => [
          Platform.OS === 'android' ? styles.androidTrigger : styles.iosTrigger,
          Platform.OS === 'ios'
            ? {
                backgroundColor: should_use_liquid_glass
                  ? 'transparent'
                  : with_color_opacity(theme.colors.paper, theme.is_dark ? 0.72 : 0.84),
                borderColor: should_use_liquid_glass ? 'transparent' : theme.colors.line,
              }
            : null,
          pressed ? styles.pressed : null,
        ]}
      >
        {render_trigger_icon()}
      </Pressable>
    </MenuView>
  );
}

const styles = StyleSheet.create({
  androidTrigger: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 40,
    paddingHorizontal: 4,
  },
  iosIcon: {
    height: 18,
    width: 22,
  },
  iosTrigger: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 32,
    minWidth: 32,
    paddingHorizontal: 8,
  },
  pressed: {
    opacity: 0.68,
  },
});

export default EpisodeActionsMenuButton;