import React from 'react';
import { MenuView } from '@react-native-menu/menu';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { observer } from 'mobx-react';

import Discover from '../stores/Discover';
import { is_liquid_glass, with_color_opacity } from '../theme/wavelengthTheme';

export const DISCOVER_FILTER_OPTIONS = [
  { icon: 'sparkles', id: 'discover', label: 'Discover' },
  { icon: 'bookmark', id: 'listen_later', label: 'Listen Later' },
];

export function discover_filter_label(filter = 'discover') {
  const match = DISCOVER_FILTER_OPTIONS.find(option => option.id === filter);

  if (match) {
    return match.label;
  } else {
    return 'Discover';
  }
}

export function discover_loading_label(filter = 'discover') {
  if (filter === 'listen_later') {
    return 'Loading Listen Later';
  } else {
    return 'Loading Discover';
  }
}

export function discover_is_pending({
  did_hydrate = false,
  is_loading = false,
} = {}) {
  if (!did_hydrate || is_loading) {
    return true;
  } else {
    return false;
  }
}

export function build_ios_discover_filter_header_items({
  did_hydrate = false,
  is_loading = false,
  selected_filter = 'discover',
  spinner = null,
} = {}) {
  const items = [];

  if (discover_is_pending({ did_hydrate, is_loading })) {
    items.push({
      accessibilityLabel: discover_loading_label(selected_filter),
      element: spinner,
      hidesSharedBackground: true,
      type: 'custom',
    });
  }

  items.push({
    accessibilityLabel: 'Filter Discover',
    label: discover_filter_label(selected_filter),
    menu: {
      items: DISCOVER_FILTER_OPTIONS.map(option => ({
        icon: { name: option.icon, type: 'sfSymbol' },
        label: option.label,
        onPress: () => Discover.set_selected_filter(option.id),
        state: option.id === selected_filter ? 'on' : 'off',
        type: 'action',
      })),
      singleSelection: true,
      title: 'Show',
    },
    type: 'menu',
  });

  return items;
}

function DiscoverFilterMenu({ theme }) {
  const should_use_liquid_glass = is_liquid_glass();
  const selected_id = Discover.selected_filter;
  const selected_label = discover_filter_label(selected_id);

  function handle_press_action({ nativeEvent }) {
    Discover.set_selected_filter(nativeEvent.event);
  }

  const actions = DISCOVER_FILTER_OPTIONS.map(option => {
    const action = {
      id: option.id,
      title: option.label,
    };

    if (Platform.OS === 'ios') {
      action.image = option.icon;
      action.state = option.id === selected_id ? 'on' : 'off';
    }

    return action;
  });

  const show_loading_indicator = discover_is_pending({
    did_hydrate: Discover.visible_did_hydrate(),
    is_loading: Discover.visible_is_loading(),
  });
  const loading_label = discover_loading_label(selected_id);

  return (
    <View style={styles.row}>
      {show_loading_indicator ? (
        <ActivityIndicator
          accessibilityLabel={loading_label}
          color={theme.colors.accent}
          size="small"
          style={styles.loadingIndicator}
        />
      ) : null}
      <MenuView
        accessibilityLabel="Filter Discover"
        actions={actions}
        onPressAction={handle_press_action}
        themeVariant={theme.is_dark ? 'dark' : 'light'}
      >
        <Pressable
          accessibilityHint="Opens a menu to filter Discover"
          accessibilityLabel={`Filter Discover, ${selected_label}`}
          accessibilityRole="button"
          style={({ pressed }) => [
            Platform.OS === 'android' ? styles.androidTrigger : styles.iosTrigger,
            Platform.OS === 'ios'
              ? {
                  backgroundColor: should_use_liquid_glass
                    ? 'transparent'
                    : with_color_opacity(theme.colors.paper, theme.is_dark ? 0.72 : 0.84),
                  borderColor: should_use_liquid_glass ? 'transparent' : theme.colors.line,
                }
              : null,
            pressed ? styles.pressed : null,
          ]}
        >
          <Text
            style={[
              Platform.OS === 'android' ? styles.androidLabel : styles.iosLabel,
              { color: theme.colors.accent_strong },
            ]}
          >
            {selected_label}
          </Text>
        </Pressable>
      </MenuView>
    </View>
  );
}

const styles = StyleSheet.create({
  androidLabel: {
    fontSize: 17,
    fontWeight: '500',
    lineHeight: 20,
  },
  androidTrigger: {
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 4,
  },
  iosLabel: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 18,
  },
  iosTrigger: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 32,
    minWidth: 58,
    paddingHorizontal: 11,
  },
  loadingIndicator: {
    height: 28,
    width: 28,
  },
  pressed: {
    opacity: 0.68,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
});

export default observer(DiscoverFilterMenu);
