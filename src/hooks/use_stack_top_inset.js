import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { stack_screen_top_inset } from '../lib/screen_top_inset';

export function use_stack_top_inset() {
  const header_height = useHeaderHeight();
  const insets = useSafeAreaInsets();

  return stack_screen_top_inset({
    header_height,
    top_safe_area_inset: insets.top,
  });
}