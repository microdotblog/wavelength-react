import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { is_liquid_glass, with_color_opacity } from '../theme/wavelengthTheme';

function HeaderPillButton({ label, onPress, theme, ...pressable_props }) {
  const should_use_liquid_glass = is_liquid_glass();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      {...pressable_props}
      style={({ pressed }) => [
        styles.headerButton,
        {
          backgroundColor: should_use_liquid_glass
            ? 'transparent'
            : with_color_opacity(theme.colors.paper, theme.is_dark ? 0.72 : 0.84),
          borderColor: should_use_liquid_glass ? 'transparent' : theme.colors.line,
        },
        pressed ? styles.pressed : null,
      ]}
    >
      <Text style={[styles.headerButtonText, { color: theme.colors.accent_strong }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerButton: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 32,
    minWidth: 58,
    paddingHorizontal: 11,
  },
  headerButtonText: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.68,
  },
});

export default HeaderPillButton;
