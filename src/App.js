import React from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import * as WebBrowser from 'expo-web-browser';
import { observer } from 'mobx-react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import SignedInNavigator from './navigation/SignedInNavigator';
import WelcomeScreen from './screens/WelcomeScreen';
import Auth from './stores/Auth';
import Episodes from './stores/Episodes';
import { build_navigation_theme, get_wavelength_theme } from './theme/wavelengthTheme';

WebBrowser.maybeCompleteAuthSession();

function LegacyUpgradeModal({ theme, visible = false }) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={() => {}}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.upgradeOverlay}>
        <View
          accessibilityLiveRegion="polite"
          accessibilityViewIsModal
          style={[
            styles.upgradeCard,
            {
              backgroundColor: theme.colors.paper,
              borderColor: theme.colors.line,
            },
          ]}
        >
          <ActivityIndicator color={theme.colors.accent} size="large" />
          <Text style={[styles.upgradeTitle, { color: theme.colors.ink }]}>
            Upgrading previous Wavelength recordings...
          </Text>
        </View>
      </View>
    </Modal>
  );
}

function App() {
  const color_scheme = useColorScheme();
  const theme = get_wavelength_theme(color_scheme === 'dark');
  const [did_complete_initial_hydration, set_did_complete_initial_hydration] =
    React.useState(false);
  const is_signed_in = Auth.is_signed_in();
  const is_loading = !did_complete_initial_hydration || Auth.is_hydrating;

  React.useEffect(() => {
    SystemUI.setBackgroundColorAsync(theme.colors.canvas);
  }, [theme.colors.canvas]);

  React.useEffect(() => {
    let is_cancelled = false;

    Auth.hydrate().finally(() => {
      if (!is_cancelled) {
        set_did_complete_initial_hydration(true);
      }
    });

    const subscription = Linking.addEventListener('url', event => {
      if (Auth.is_signing_in && Auth.can_handle_open_url(event?.url)) {
        return;
      }

      Auth.handle_open_url(event?.url);
    });

    return () => {
      is_cancelled = true;
      subscription?.remove?.();
    };
  }, []);

  if (is_loading) {
    return (
      <View style={[styles.loadingScreen, { backgroundColor: theme.colors.canvas }]}>
        <StatusBar style={theme.is_dark ? 'light' : 'dark'} />
        <ActivityIndicator color={theme.colors.accent} size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <KeyboardProvider preload={false}>
          <StatusBar style={theme.is_dark ? 'light' : 'dark'} />
          {is_signed_in ? (
            <NavigationContainer theme={build_navigation_theme(theme)}>
              <SignedInNavigator theme={theme} />
            </NavigationContainer>
          ) : (
            <WelcomeScreen theme={theme} />
          )}
          <LegacyUpgradeModal
            theme={theme}
            visible={is_signed_in && Episodes.is_upgrading_legacy}
          />
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  root: {
    flex: 1,
  },
  upgradeCard: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 24,
    borderWidth: 1,
    gap: 18,
    maxWidth: 420,
    paddingHorizontal: 28,
    paddingVertical: 30,
    width: '100%',
  },
  upgradeOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.20)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  upgradeTitle: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
    textAlign: 'center',
  },
});

export default observer(App);
