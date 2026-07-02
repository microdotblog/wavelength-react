import React from 'react';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { native_tab_bar_bottom_offset } from '../lib/tab_bar_inset';

export function use_tab_bar_bottom_offset() {
  const context_height = React.useContext(BottomTabBarHeightContext);
  const insets = useSafeAreaInsets();

  if (typeof context_height === 'number' && context_height > 0) {
    return context_height;
  }

  return native_tab_bar_bottom_offset(insets.bottom);
}