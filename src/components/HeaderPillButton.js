import React from 'react';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';
import { HeaderBackButton } from '@react-navigation/elements';

import { is_liquid_glass, with_color_opacity } from '../theme/wavelengthTheme';

function HeaderPillButton({
  accessibilityLabel,
  disabled = false,
  label,
  onPress,
  placement = 'trailing',
  theme,
  ...pressable_props
}) {
  const should_use_liquid_glass = is_liquid_glass();

  if (Platform.OS === 'android') {
    if (placement === 'leading') {
      return (
        <HeaderBackButton
          accessibilityLabel={accessibilityLabel ?? label}
          disabled={disabled}
          displayMode="minimal"
          onPress={onPress}
          tintColor={theme.colors.ink}
          {...pressable_props}
        />
      );
    }

    return (
      <Pressable
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityRole="button"
        disabled={disabled}
        onPress={onPress}
        {...pressable_props}
        hitSlop={{ bottom: 8, left: 8, right: 8, top: 8 }}
        style={({ pressed }) => [
          styles.androidTextButton,
          disabled ? styles.disabled : null,
          pressed && !disabled ? styles.pressed : null,
        ]}
      >
        <Text style={[styles.androidTextButtonLabel, { color: theme.colors.accent_strong }]}>
          {label}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      {...pressable_props}
      style={({ pressed }) => [
        styles.headerButton,
        {
          backgroundColor: should_use_liquid_glass
            ? 'transparent'
            : with_color_opacity(theme.colors.paper, theme.is_dark ? 0.72 : 0.84),
          borderColor: should_use_liquid_glass ? 'transparent' : theme.colors.line,
          opacity: disabled ? 0.45 : 1,
        },
        pressed && !disabled ? styles.pressed : null,
      ]}
    >
      <Text style={[styles.headerButtonText, { color: theme.colors.accent_strong }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  androidTextButton: {
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 4,
  },
  androidTextButtonLabel: {
    fontSize: 17,
    fontWeight: '500',
    lineHeight: 20,
  },
  disabled: {
    opacity: 0.38,
  },
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