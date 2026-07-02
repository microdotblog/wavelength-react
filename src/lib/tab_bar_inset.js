import { Platform } from 'react-native';

import { is_liquid_glass } from '../theme/wavelengthTheme';

const ANDROID_NATIVE_TAB_BAR_HEIGHT = 80;
const IOS_NATIVE_TAB_BAR_HEIGHT = 49;
const IOS_LIQUID_GLASS_TAB_BAR_HEIGHT = 56;

export function native_tab_bar_bottom_offset(bottom_safe_area_inset = 0) {
  if (Platform.OS === 'android') {
    return bottom_safe_area_inset + ANDROID_NATIVE_TAB_BAR_HEIGHT;
  }

  if (is_liquid_glass()) {
    return bottom_safe_area_inset + IOS_LIQUID_GLASS_TAB_BAR_HEIGHT;
  }

  return bottom_safe_area_inset + IOS_NATIVE_TAB_BAR_HEIGHT;
}