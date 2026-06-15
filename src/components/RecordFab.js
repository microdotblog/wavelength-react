import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MIC_ICON = require('../../assets/icons/tab_bar/mic.png');
const ANDROID_TAB_BAR_HEIGHT = 80;

function RecordFab({ onPress, theme }) {
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={[styles.container, { bottom: insets.bottom + ANDROID_TAB_BAR_HEIGHT + 16 }]}
    >
      <Pressable
        accessibilityLabel="New recording"
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.fab,
          {
            backgroundColor: theme.colors.accent,
            boxShadow: theme.is_dark
              ? '0 10px 18px rgba(0, 0, 0, 0.4)'
              : '0 10px 18px rgba(95, 53, 0, 0.28)',
          },
          pressed ? styles.pressed : null,
        ]}
      >
        <Image
          source={MIC_ICON}
          style={[styles.icon, { tintColor: theme.colors.button_text }]}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-end',
    left: 0,
    position: 'absolute',
    right: 20,
  },
  fab: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 30,
    height: 60,
    justifyContent: 'center',
    width: 60,
  },
  icon: {
    height: 28,
    width: 28,
  },
  pressed: {
    opacity: 0.82,
  },
});

export default RecordFab;
