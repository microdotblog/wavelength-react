import { Platform } from 'react-native';

const IOS_NAVIGATION_BAR_HEIGHT = 44;

export function stack_screen_top_inset({
  header_height = 0,
  top_safe_area_inset = 0,
} = {}) {
  if (Platform.OS !== 'ios') {
    return 0;
  }

  if (header_height > 0) {
    return header_height;
  }

  return top_safe_area_inset + IOS_NAVIGATION_BAR_HEIGHT;
}