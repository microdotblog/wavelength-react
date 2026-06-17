import React from 'react';
import { Platform, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { observer } from 'mobx-react';

import AccountScreen from '../screens/AccountScreen';
import EditScreen from '../screens/EditScreen';
import HeaderPillButton from '../components/HeaderPillButton';
import RecordFab from '../components/RecordFab';
import RecordScreen from '../screens/RecordScreen';
import SplitScreen from '../screens/SplitScreen';
import TabNavigator from './TabNavigator';
import { build_stack_screen_options } from './screenOptions';
import { header_left_element } from '../theme/wavelengthTheme';

const Stack = createNativeStackNavigator();

function SignedInNavigator({ theme }) {
  return (
    <Stack.Navigator
      initialRouteName="MainTabs"
      screenOptions={build_stack_screen_options(theme)}
    >
      <Stack.Screen
        name="MainTabs"
        options={{ headerShown: false }}
      >
        {screen_props => (
          <View style={{ flex: 1 }}>
            <TabNavigator
              {...screen_props}
              theme={theme}
            />
            {Platform.OS === 'android' ? (
              <RecordFab
                onPress={() => screen_props.navigation.navigate('Record')}
                theme={theme}
              />
            ) : null}
          </View>
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
        options={({ navigation, route }) => ({
          title: route.params?.episode_id ? 'Add Segment' : 'New Recording',
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
          headerLargeTitle: false,
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
      <Stack.Screen
        name="Split"
        options={({ navigation }) => ({
          title: 'Split Segment',
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
          <SplitScreen
            {...screen_props}
            theme={theme}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

export default observer(SignedInNavigator);
