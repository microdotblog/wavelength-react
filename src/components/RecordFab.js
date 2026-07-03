import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ANDROID_RECORD_FAB_LAYOUT, native_tab_bar_bottom_offset } from '../lib/tab_bar_inset';

const MIC_ICON = require('../../assets/icons/tab_bar/mic.png');

function RecordFab({ onPress, theme }) {
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.container,
        {
          bottom: native_tab_bar_bottom_offset(insets.bottom) + ANDROID_RECORD_FAB_LAYOUT.bottom_gap,
        },
      ]}
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
    right: ANDROID_RECORD_FAB_LAYOUT.right_inset,
  },
  fab: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: ANDROID_RECORD_FAB_LAYOUT.size / 2,
    height: ANDROID_RECORD_FAB_LAYOUT.size,
    justifyContent: 'center',
    width: ANDROID_RECORD_FAB_LAYOUT.size,
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
