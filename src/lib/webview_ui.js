import { Platform } from 'react-native';

import { is_liquid_glass } from '../theme/wavelengthTheme';

const LIQUID_GLASS_WEBVIEW_TAB_BAR_PADDING = 56;
const ANDROID_TAB_BAR_PADDING = 96;

function liquid_glass_webview_bottom_inset(bottom_safe_area_inset = 0) {
  if (!is_liquid_glass()) {
    return 0;
  }

  return bottom_safe_area_inset + LIQUID_GLASS_WEBVIEW_TAB_BAR_PADDING;
}

export function tab_bar_bottom_inset(bottom_safe_area_inset = 0) {
  if (Platform.OS === 'android') {
    return bottom_safe_area_inset + ANDROID_TAB_BAR_PADDING;
  }

  return liquid_glass_webview_bottom_inset(bottom_safe_area_inset);
}
