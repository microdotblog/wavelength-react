import React from 'react';
import { MenuView } from '@react-native-menu/menu';
import { Pressable, StyleSheet, Text } from 'react-native';

import { is_liquid_glass, with_color_opacity } from '../theme/wavelengthTheme';

function EpisodeActionsMenuButton({ on_delete, on_rename, theme }) {
  const should_use_liquid_glass = is_liquid_glass();

  function handle_press_action({ nativeEvent }) {
    const action_id = nativeEvent.event;

    if (action_id === 'rename') {
      on_rename();
      return;
    }

    if (action_id === 'delete') {
      on_delete();
    }
  }

  return (
    <MenuView
      accessibilityLabel="Episode actions"
      actions={[
        { id: 'rename', title: 'Rename' },
        {
          attributes: { destructive: true },
          id: 'delete',
          title: 'Delete Episode',
        },
      ]}
      onPressAction={handle_press_action}
      themeVariant={theme.is_dark ? 'dark' : 'light'}
    >
      <Pressable
        accessibilityLabel="Episode actions"
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.trigger,
          {
            backgroundColor: should_use_liquid_glass
              ? 'transparent'
              : with_color_opacity(theme.colors.paper, theme.is_dark ? 0.72 : 0.84),
            borderColor: should_use_liquid_glass ? 'transparent' : theme.colors.line,
          },
          pressed ? styles.pressed : null,
        ]}
      >
        <Text style={[styles.triggerGlyph, { color: theme.colors.accent_strong }]}>⋮</Text>
      </Pressable>
    </MenuView>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.68,
  },
  trigger: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 32,
    minWidth: 32,
    paddingHorizontal: 8,
  },
  triggerGlyph: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 22,
  },
});

export default EpisodeActionsMenuButton;