import { Platform } from 'react-native';

import { is_liquid_glass } from '../theme/wavelengthTheme';

export function build_stack_screen_options(theme) {
  return {
    contentStyle: {
      backgroundColor: theme.colors.canvas,
    },
    headerBackButtonDisplayMode: 'minimal',
    ...(is_liquid_glass()
      ? null
      : { headerBlurEffect: theme.is_dark ? 'systemMaterialDark' : 'systemMaterialLight' }),
    headerLargeStyle: {
      backgroundColor: theme.colors.canvas,
    },
    headerLargeTitle: Platform.OS === 'ios',
    headerLargeTitleShadowVisible: false,
    headerShadowVisible: false,
    headerStyle: {
      backgroundColor: Platform.OS === 'ios' ? 'transparent' : theme.colors.paper,
    },
    headerTintColor: theme.colors.ink,
    headerTitleStyle: {
      color: theme.colors.ink,
      fontSize: 17,
      fontWeight: '700',
    },
    headerTransparent: Platform.OS === 'ios',
  };
}
