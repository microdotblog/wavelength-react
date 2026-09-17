import React from 'react';
import { MenuView } from '@react-native-menu/menu';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { observer } from 'mobx-react';

import Episodes from '../stores/Episodes';
import Posts from '../stores/Posts';
import {
  RECORDING_FILTER_OPTIONS,
  recording_filter_label,
  recordings_list_status,
} from '../lib/recordings_filter';
import { is_liquid_glass, with_color_opacity } from '../theme/wavelengthTheme';

export function build_ios_recordings_filter_header_items({
  did_hydrate = false,
  is_loading = false,
  on_record,
  selected_filter = 'all',
  show_record = false,
  spinner = null,
} = {}) {
  const items = [];

  if (!did_hydrate || is_loading) {
    items.push({
      accessibilityLabel: 'Loading recordings',
      element: spinner,
      hidesSharedBackground: true,
      type: 'custom',
    });
  }

  items.push({
    accessibilityLabel: 'Filter recordings',
    label: recording_filter_label(selected_filter),
    menu: {
      items: RECORDING_FILTER_OPTIONS.map(option => ({
        icon: { name: option.icon, type: 'sfSymbol' },
        label: option.label,
        onPress: () => Episodes.set_selected_filter(option.id),
        state: option.id === selected_filter ? 'on' : 'off',
        type: 'action',
      })),
      singleSelection: true,
      title: 'Show',
    },
    type: 'menu',
  });

  if (show_record) {
    items.push({
      accessibilityLabel: 'Record',
      label: 'Record',
      onPress: on_record,
      type: 'button',
    });
  }

  return items;
}

function RecordingsFilterMenu({ theme }) {
  const should_use_liquid_glass = is_liquid_glass();
  const selected_id = Episodes.selected_filter;
  const selected_label = recording_filter_label(selected_id);

  function handle_press_action({ nativeEvent }) {
    Episodes.set_selected_filter(nativeEvent.event);
  }

  const actions = RECORDING_FILTER_OPTIONS.map(option => {
    const action = {
      id: option.id,
      state: option.id === selected_id ? 'on' : 'off',
      title: option.label,
    };

    if (Platform.OS === 'ios') {
      action.image = option.icon;
    }

    return action;
  });

  const list_status = recordings_list_status({
    episodes_did_hydrate: Episodes.did_hydrate,
    episodes_is_loading: Episodes.is_loading,
    filter: selected_id,
    posts_did_hydrate: Posts.did_hydrate,
    posts_error_message: Posts.error_message,
    posts_is_loading: Posts.is_loading,
  });
  const show_loading_indicator = list_status.is_loading;

  return (
    <View style={styles.row}>
      {show_loading_indicator ? (
        <ActivityIndicator
          accessibilityLabel="Loading recordings"
          color={theme.colors.accent}
          size="small"
          style={styles.loadingIndicator}
        />
      ) : null}
      <MenuView
        accessibilityLabel="Filter recordings"
        actions={actions}
        onPressAction={handle_press_action}
        themeVariant={theme.is_dark ? 'dark' : 'light'}
      >
        <Pressable
          accessibilityHint="Opens a menu to filter recordings"
          accessibilityLabel={`Filter recordings, ${selected_label}`}
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

export default observer(RecordingsFilterMenu);
