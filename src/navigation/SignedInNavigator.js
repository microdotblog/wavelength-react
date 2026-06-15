import React from 'react';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { observer } from 'mobx-react';

import AccountScreen from '../screens/AccountScreen';
import EditScreen from '../screens/EditScreen';
import RecordScreen from '../screens/RecordScreen';
import StudioScreen from '../screens/StudioScreen';
import {
  header_left_element,
  header_right_element,
  is_liquid_glass,
  with_color_opacity,
} from '../theme/wavelengthTheme';

const Stack = createNativeStackNavigator();

function SignedInNavigator({ theme }) {
  const common_screen_options = {
    contentStyle: {
      backgroundColor: theme.colors.canvas,
    },
    headerBackButtonDisplayMode: 'minimal',
    headerBlurEffect: theme.is_dark ? 'systemMaterialDark' : 'systemMaterialLight',
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

  return (
    <Stack.Navigator
      initialRouteName="Studio"
      screenOptions={common_screen_options}
    >
      <Stack.Screen
        name="Studio"
        options={({ navigation }) => ({
          title: 'Studio',
          ...header_right_element(() => (
            <HeaderPillButton
              label="Account"
              onPress={() => navigation.navigate('Account')}
              theme={theme}
            />
          )),
        })}
      >
        {screen_props => (
          <StudioScreen
            {...screen_props}
            theme={theme}
          />
        )}
      </Stack.Screen>
      <Stack.Screen
        name="Account"
        options={({ navigation }) => ({
          title: 'Account',
          ...header_left_element(() => (
            <HeaderPillButton
              label="Done"
              onPress={() => navigation.goBack()}
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
        name="Record"
        options={({ navigation }) => ({
          title: 'New Recording',
          ...header_left_element(() => (
            <HeaderPillButton
              label="Done"
              onPress={() => navigation.goBack()}
              theme={theme}
            />
          )),
        })}
      >
        {screen_props => (
          <RecordScreen
            {...screen_props}
            theme={theme}
          />
        )}
      </Stack.Screen>
      <Stack.Screen
        name="Edit"
        options={({ navigation }) => ({
          title: 'Episode',
          ...header_left_element(() => (
            <HeaderPillButton
              label="Done"
              onPress={() => navigation.goBack()}
              theme={theme}
            />
          )),
        })}
      >
        {screen_props => (
          <EditScreen
            {...screen_props}
            theme={theme}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

function HeaderPillButton({ label, onPress, theme }) {
  const should_use_liquid_glass = is_liquid_glass();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.headerButton,
        {
          backgroundColor: should_use_liquid_glass
            ? 'transparent'
            : with_color_opacity(theme.colors.paper, theme.is_dark ? 0.72 : 0.84),
          borderColor: should_use_liquid_glass ? 'transparent' : theme.colors.line,
        },
        pressed ? styles.pressed : null,
      ]}
    >
      <Text style={[styles.headerButtonText, { color: theme.colors.accent_strong }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerButton: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 32,
    minWidth: 58,
    paddingHorizontal: 11,
  },
  headerButtonText: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.68,
  },
});

export default observer(SignedInNavigator);
