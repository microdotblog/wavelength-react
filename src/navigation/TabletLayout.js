import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View, useColorScheme, useWindowDimensions } from 'react-native';
import { ScreenStack, ScreenStackHeaderLeftView, ScreenStackHeaderRightView, ScreenStackItem } from 'react-native-screens';
import { SafeAreaView, Split } from 'react-native-screens/experimental';
import { SFSymbol } from 'react-native-sfsymbols';

import HeaderProfileButton from '../components/HeaderProfileButton';
import { SidebarNavigationContext, SidebarVisibleContext } from './SidebarContext';
import { get_wavelength_theme } from '../theme/wavelengthTheme';

const SECTIONS = {
  RecordingsStack: { label: 'Recordings', icon: 'waveform' },
  PostsStack: { label: 'Posts', icon: 'doc.text' },
  DiscoverStack: { label: 'Discover', icon: 'magnifyingglass' },
};

export function is_wide_tablet_window(width, height) {
  return width >= 768 && width > height;
}

export default function TabletLayout({ children, navigation, state }) {
  const { width, height } = useWindowDimensions();
  const theme = get_wavelength_theme(useColorScheme() === 'dark');
  const wide = is_wide_tablet_window(width, height);
  const [collapsed, set_collapsed] = React.useState(false);
  const sidebar_visible = wide && !collapsed;
  const selected_background = { backgroundColor: theme.colors.accent_soft };
  const main_tabs = state.routes.find(route => route.name === 'MainTabs');
  const tabs_state = main_tabs?.state;
  const selected_section = tabs_state
    ? tabs_state.routes[tabs_state.index].name
    : main_tabs?.params?.screen || 'RecordingsStack';
  const guards_ref = React.useRef(new Map());
  const register_guard = React.useCallback((route_key, guard) => {
    guards_ref.current.set(route_key, guard);
    return () => guards_ref.current.delete(route_key);
  }, []);

  function request_navigation(action) {
    const notices = state.routes.slice().reverse()
      .map(route => guards_ref.current.get(route.key)?.())
      .filter(Boolean);
    const blocked = notices.find(notice => !notice.can_discard);

    if (blocked) {
      Alert.alert(blocked.title, blocked.message);
    } else if (notices.length > 0) {
      Alert.alert(
        'Discard edits?',
        notices.map(notice => notice.message).join('\n\n'),
        [
          { style: 'cancel', text: 'Keep editing' },
          {
            onPress: action,
            style: 'destructive',
            text: 'Discard',
          },
        ],
      );
    } else {
      action();
    }
  }

  function select_section(name) {
    request_navigation(() => navigation.popTo('MainTabs', { screen: name }));
  }

  function new_recording() {
    const current_route = state.routes[state.index];
    if (current_route.name === 'Record' && !current_route.params?.episode_id && !current_route.params?.narration_post_uid) {
      return;
    }

    request_navigation(() => navigation.reset({
      index: 1,
      routes: [main_tabs, { name: 'Record' }],
    }));
  }

  return (
    <SidebarVisibleContext.Provider value={sidebar_visible}>
      <SidebarNavigationContext.Provider value={register_guard}>
        <Split.Host
          columnMetrics={{
            minimumPrimaryColumnWidth: 240,
            maximumPrimaryColumnWidth: 320,
            preferredPrimaryColumnWidthOrFraction: 280,
          }}
          displayModeButtonVisibility="never"
          onCollapse={() => set_collapsed(true)}
          onExpand={() => set_collapsed(false)}
          preferredDisplayMode={wide ? 'oneBesideSecondary' : 'secondaryOnly'}
          preferredSplitBehavior="tile"
          primaryBackgroundStyle="sidebar"
          presentsWithGesture={false}
          showSecondaryToggleButton={false}
          topColumnForCollapsing="secondary"
        >
          <Split.Column>
            <ScreenStack style={styles.fill}>
              <ScreenStackItem
                headerConfig={{
                  title: '',
                  hideShadow: true,
                  translucent: true,
                  children: (
                    <>
                      <ScreenStackHeaderLeftView hidesSharedBackground>
                        <HeaderProfileButton
                          onPress={() => navigation.getParent()?.navigate('Account')}
                          theme={theme}
                        />
                      </ScreenStackHeaderLeftView>
                      <ScreenStackHeaderRightView hidesSharedBackground>
                        <Pressable
                          accessibilityLabel="New recording"
                          accessibilityRole="button"
                          onPress={new_recording}
                          style={[styles.record_button, { backgroundColor: theme.colors.accent }]}
                        >
                          <SFSymbol
                            color={theme.colors.button_text}
                            name="mic.fill"
                            style={styles.record_icon}
                          />
                          <Text style={[styles.record_label, { color: theme.colors.button_text }]}>
                            New Recording
                          </Text>
                        </Pressable>
                      </ScreenStackHeaderRightView>
                    </>
                  ),
                }}
                screenId="sidebar"
              >
                <View style={styles.sidebar}>
                  <ScrollView
                    contentContainerStyle={styles.sections}
                    contentInsetAdjustmentBehavior="automatic"
                  >
                    {Object.entries(SECTIONS).map(([name, section]) => {
                      const selected = selected_section === name;

                      return (
                        <Pressable
                          accessibilityRole="tab"
                          accessibilityState={{ selected }}
                          key={name}
                          onPress={() => select_section(name)}
                          style={[styles.row, selected ? selected_background : null]}
                        >
                          <SFSymbol
                            color={theme.colors.accent}
                            name={section.icon}
                            style={styles.icon}
                          />
                          <Text style={[styles.label, { color: theme.colors.ink }]}>
                            {section.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              </ScreenStackItem>
            </ScreenStack>
          </Split.Column>
          <Split.Column>
            <SafeAreaView edges={{ left: true, right: true }}>{children}</SafeAreaView>
          </Split.Column>
        </Split.Host>
      </SidebarNavigationContext.Provider>
    </SidebarVisibleContext.Provider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  sidebar: { flex: 1 },
  sections: { paddingHorizontal: 12, paddingTop: 12 },
  row: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 12,
    flexDirection: 'row',
    marginBottom: 4,
    minHeight: 48,
    padding: 12,
  },
  icon: { height: 24, width: 24 },
  label: { flex: 1, fontSize: 18, marginLeft: 12 },
  record_button: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: 12,
  },
  record_icon: { height: 16, width: 16 },
  record_label: { fontSize: 14, fontWeight: '700', marginLeft: 7 },
});
