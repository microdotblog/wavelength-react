import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AccountScreen from '../screens/AccountScreen';
import BlogSelectionScreen from '../screens/BlogSelectionScreen';
import PlatformSymbol from '../components/PlatformSymbol';
import { build_stack_screen_options } from './screenOptions';
import { header_left_element } from '../theme/wavelengthTheme';

const Stack = createNativeStackNavigator();

function SettingsNavigator({ theme }) {
  return (
    <Stack.Navigator screenOptions={build_stack_screen_options(theme)}>
      <Stack.Screen
        name="SettingsHome"
        options={({ navigation }) => ({
          title: 'Settings',
          headerBackVisible: false,
          headerLargeTitle: false,
          ...header_left_element(() => (
            <HeaderCloseButton
              onPress={() => navigation.getParent()?.goBack()}
              theme={theme}
            />
          )),
        })}
      >
        {screen_props => (
          <AccountScreen
            {...screen_props}
            theme={theme}
          />
        )}
      </Stack.Screen>
      <Stack.Screen
        name="BlogSelection"
        options={{
          title: 'Blogs',
          headerLargeTitle: false,
        }}
      >
        {screen_props => (
          <BlogSelectionScreen
            {...screen_props}
            theme={theme}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

function HeaderCloseButton({ onPress, theme }) {
  return (
    <Pressable
      accessibilityLabel="Close settings"
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.closeButton,
        pressed ? styles.pressed : null,
      ]}
    >
      <PlatformSymbol
        color={theme.colors.ink}
        name="xmark"
        size={16}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  closeButton: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  pressed: {
    opacity: 0.68,
  },
});

export default SettingsNavigator;
