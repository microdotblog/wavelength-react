import { Platform } from 'react-native';

import { is_liquid_glass } from '../theme/wavelengthTheme';

const IOS_NAVIGATION_BAR_HEIGHT = 44;
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

export function web_view_top_inset({ header_height = 0, top_safe_area_inset = 0 } = {}) {
  if (Platform.OS === 'android') {
    return 0;
  }

  if (header_height > 0) {
    return header_height;
  }

  return top_safe_area_inset + IOS_NAVIGATION_BAR_HEIGHT;
}
