import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { observer } from 'mobx-react';

import Auth from '../stores/Auth';
import { is_liquid_glass } from '../theme/wavelengthTheme';

const AVATAR_SIZE = 28;

function HeaderProfileButton({ onPress, theme }) {
  const profile = Auth.current_profile();
  const profile_photo = `${profile.photo || ''}`.trim();
  const username = `${profile.username || ''}`.trim();
  const should_use_liquid_glass = is_liquid_glass();
  const accessibility_label = username ? `Account for @${username}` : 'Account';

  return (
    <Pressable
      accessibilityLabel={accessibility_label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        should_use_liquid_glass ? styles.button_liquid_glass : null,
        Platform.OS === 'android' && !should_use_liquid_glass ? styles.button_android : null,
        pressed ? styles.pressed : null,
      ]}
    >
      {profile_photo ? (
        <Image
          contentFit="cover"
          source={{ uri: profile_photo }}
          style={styles.avatar}
        />
      ) : (
        <View
          style={[
            styles.avatar,
            styles.placeholder,
            { backgroundColor: theme.colors.line },
          ]}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  avatar: {
    borderCurve: 'continuous',
    borderRadius: AVATAR_SIZE / 2,
    height: AVATAR_SIZE,
    width: AVATAR_SIZE,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  button_android: {
    marginLeft: 12,
    marginRight: 12,
  },
  button_liquid_glass: {
    height: AVATAR_SIZE,
    width: AVATAR_SIZE,
  },
  placeholder: {},
  pressed: {
    opacity: 0.68,
  },
});

export default observer(HeaderProfileButton);
