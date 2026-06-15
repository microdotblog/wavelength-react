import React from 'react';
import { Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { observer } from 'mobx-react';

import AccountScreen from '../screens/AccountScreen';
import EditScreen from '../screens/EditScreen';
import HeaderPillButton from '../components/HeaderPillButton';
import RecordScreen from '../screens/RecordScreen';
import StudioScreen from '../screens/StudioScreen';
import {
  header_left_element,
  header_right_element,
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

export default observer(SignedInNavigator);
