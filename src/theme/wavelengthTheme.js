import { DarkTheme, DefaultTheme } from '@react-navigation/native';
import { Platform } from 'react-native';

export const MICRO_BLOG_ACCENT_COLOR = '#ff8800';
export const WAVELENGTH_GOLD = '#ffc400';

export function get_wavelength_theme(is_dark = false) {
  if (is_dark) {
    return {
      is_dark: true,
      colors: {
        accent: MICRO_BLOG_ACCENT_COLOR,
        accent_strong: MICRO_BLOG_ACCENT_COLOR,
        accent_soft: 'rgba(255, 136, 0, 0.22)',
        button_icon_background: '#fff1c6',
        button_text: '#ffffff',
        canvas: '#15100b',
        glass: 'rgba(44, 33, 22, 0.78)',
        ink: '#fff7e8',
        ink_soft: '#d9c0a8',
        line: 'rgba(255, 136, 0, 0.2)',
        paper: '#21180f',
        paper_alt: '#2d2115',
        tint: MICRO_BLOG_ACCENT_COLOR,
        warning: '#ffd36a',
      },
    };
  }

  return {
    is_dark: false,
    colors: {
      accent: MICRO_BLOG_ACCENT_COLOR,
      accent_strong: MICRO_BLOG_ACCENT_COLOR,
      accent_soft: '#fff1c6',
      button_icon_background: '#fff1c6',
      button_text: '#ffffff',
      canvas: '#fffaf0',
      glass: 'rgba(255, 255, 255, 0.78)',
      ink: '#24180d',
      ink_soft: '#756657',
      line: 'rgba(255, 136, 0, 0.2)',
      paper: '#ffffff',
      paper_alt: '#fff3d2',
      tint: MICRO_BLOG_ACCENT_COLOR,
      warning: WAVELENGTH_GOLD,
    },
  };
}

export function build_navigation_theme(theme) {
  const base_theme = theme.is_dark ? DarkTheme : DefaultTheme;

  return {
    ...base_theme,
    colors: {
      ...base_theme.colors,
      background: theme.colors.canvas,
      border: theme.colors.line,
      card: theme.colors.paper,
      notification: theme.colors.accent,
      primary: theme.colors.accent,
      text: theme.colors.ink,
    },
  };
}

export function is_liquid_glass(platform = Platform) {
  return platform.OS === 'ios' && parseInt(platform.Version, 10) >= 26;
}

export function header_left_element(render_element, options = {}) {
  if (is_liquid_glass()) {
    return {
      unstable_headerLeftItems: () => [custom_header_item(render_element(), options)],
    };
  }

  return {
    headerLeft: render_element,
  };
}

export function header_right_element(render_element, options = {}) {
  if (is_liquid_glass()) {
    return {
      unstable_headerRightItems: () => [custom_header_item(render_element(), options)],
    };
  }

  return {
    headerRight: render_element,
  };
}

export function with_color_opacity(color_value = '', opacity = 1) {
  const normalized_color = `${color_value || ''}`.trim();
  const normalized_opacity = Number.isFinite(opacity)
    ? Math.min(Math.max(opacity, 0), 1)
    : 1;
  const hex_match = normalized_color.match(/^#([0-9a-f]{6})$/i);

  if (!hex_match) {
    return normalized_color || `rgba(255, 255, 255, ${normalized_opacity})`;
  }

  const hex = hex_match[1];
  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${normalized_opacity})`;
}

function custom_header_item(element, options = {}) {
  return {
    element,
    hidesSharedBackground: options.hidesSharedBackground === true,
    type: 'custom',
  };
}
