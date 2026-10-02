import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useColorScheme, useWindowDimensions } from 'react-native';
import { ScreenStack, ScreenStackHeaderLeftView, ScreenStackHeaderRightView, ScreenStackItem } from 'react-native-screens';
import { SafeAreaView, Split } from 'react-native-screens/experimental';
import { SFSymbol } from 'react-native-sfsymbols';

import HeaderProfileButton from '../components/HeaderProfileButton';
import { get_wavelength_theme } from '../theme/wavelengthTheme';

export const SidebarVisibleContext = React.createContext(false);

const SECTIONS = {
  RecordingsStack: { label: 'Recordings', icon: 'waveform' },
  PostsStack: { label: 'Posts', icon: 'doc.text' },
  DiscoverStack: { label: 'Discover', icon: 'magnifyingglass' },
};

export function is_wide_tablet_window(width, height) {
  return width >= 768 && width > height;
}

export default function TabletLayout({ children, descriptors, navigation, state }) {
  const { width, height } = useWindowDimensions();
  const theme = get_wavelength_theme(useColorScheme() === 'dark');
  const wide = is_wide_tablet_window(width, height);
  const [collapsed, set_collapsed] = React.useState(false);
  const sidebar_visible = wide && !collapsed;
  const selected_background = { backgroundColor: theme.colors.accent_soft };
  const selected_route = state.routes[state.index];
  // The native tab host does not follow sidebar-driven selection inside the split view.
  const detail = wide ? descriptors[selected_route.key].render() : children;

  return (
    <SidebarVisibleContext.Provider value={sidebar_visible}>
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
                        onPress={() => navigation.getParent()?.navigate('Record')}
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
                  {state.routes.map((route, index) => {
                    const section = SECTIONS[route.name];
                    if (!section) {
                      return null;
                    }

                    const selected = state.index === index;

                    return (
                      <Pressable
                        accessibilityRole="tab"
                        accessibilityState={{ selected }}
                        key={route.key}
                        onPress={() => navigation.navigate(route.name)}
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
          <SafeAreaView edges={{ left: true, right: true }}>{detail}</SafeAreaView>
        </Split.Column>
      </Split.Host>
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
