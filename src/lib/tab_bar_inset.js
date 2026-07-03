import { Platform } from 'react-native';

import { is_liquid_glass } from '../theme/wavelengthTheme';

const ANDROID_NATIVE_TAB_BAR_HEIGHT = 80;
const ANDROID_RECORD_FAB_DOCK_GAP = 12;
const ANDROID_RECORD_FAB_RIGHT_INSET = 20;
const ANDROID_RECORD_FAB_SIZE = 60;
const IOS_NATIVE_TAB_BAR_HEIGHT = 49;
const IOS_LIQUID_GLASS_TAB_BAR_HEIGHT = 56;

export const ANDROID_RECORD_FAB_LAYOUT = {
  bottom_gap: 16,
  dock_gap: ANDROID_RECORD_FAB_DOCK_GAP,
  right_inset: ANDROID_RECORD_FAB_RIGHT_INSET,
  size: ANDROID_RECORD_FAB_SIZE,
};

export function android_record_fab_reserved_width() {
  if (Platform.OS !== 'android') {
    return 0;
  }

  return (
    ANDROID_RECORD_FAB_RIGHT_INSET
    + ANDROID_RECORD_FAB_SIZE
    + ANDROID_RECORD_FAB_DOCK_GAP
  );
}

export function native_tab_bar_bottom_offset(bottom_safe_area_inset = 0) {
  if (Platform.OS === 'android') {
    return bottom_safe_area_inset + ANDROID_NATIVE_TAB_BAR_HEIGHT;
  }

  if (is_liquid_glass()) {
    return bottom_safe_area_inset + IOS_LIQUID_GLASS_TAB_BAR_HEIGHT;
  }

  return bottom_safe_area_inset + IOS_NATIVE_TAB_BAR_HEIGHT;
}