import React from 'react';
import { Platform, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { observer } from 'mobx-react';

import EditScreen from '../screens/EditScreen';
import HeaderPillButton from '../components/HeaderPillButton';
import PostEditScreen from '../screens/PostEditScreen';
import PublishOptionsScreen from '../screens/PublishOptionsScreen';
import PublishScreen from '../screens/PublishScreen';
import DiscoverPlaybackProvider from '../components/DiscoverPlaybackProvider';
import RecordFab from '../components/RecordFab';
import RecordScreen from '../screens/RecordScreen';
import SettingsNavigator from './SettingsNavigator';
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
            <DiscoverPlaybackProvider theme={theme}>
              <TabNavigator
                {...screen_props}
                theme={theme}
              />
            </DiscoverPlaybackProvider>
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
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      >
        {screen_props => (
          <SettingsNavigator
            {...screen_props}
            theme={theme}
          />
        )}
      </Stack.Screen>
      <Stack.Screen
        name="Record"
        options={({ route }) => ({
          title: route.params?.episode_id ? 'Add Segment' : 'New Recording',
          headerLargeTitle: false,
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
        options={{
          title: '',
          headerLargeTitle: false,
          unmountOnBlur: true,
        }}
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
          headerLargeTitle: false,
          unmountOnBlur: true,
          ...header_left_element(() => (
            <HeaderPillButton
              label="Done"
              onPress={() => navigation.goBack()}
              placement="leading"
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
      <Stack.Screen
        name="PostEdit"
        options={({ navigation }) => ({
          title: 'Edit Post',
          headerLargeTitle: false,
          ...header_left_element(() => (
            <HeaderPillButton
              label="Cancel"
              onPress={() => navigation.goBack()}
              placement="leading"
              theme={theme}
            />
          )),
        })}
      >
        {screen_props => (
          <PostEditScreen
            {...screen_props}
            theme={theme}
          />
        )}
      </Stack.Screen>
      <Stack.Screen
        name="Publish"
        options={({ navigation }) => ({
          title: 'New Post',
          headerLargeTitle: false,
          ...header_left_element(() => (
            <HeaderPillButton
              label="Cancel"
              onPress={() => navigation.goBack()}
              placement="leading"
              theme={theme}
            />
          )),
        })}
      >
        {screen_props => (
          <PublishScreen
            {...screen_props}
            theme={theme}
          />
        )}
      </Stack.Screen>
      <Stack.Screen
        name="PublishOptions"
        options={({ navigation }) => ({
          title: 'Options',
          headerLargeTitle: false,
          ...header_left_element(() => (
            <HeaderPillButton
              label="Done"
              onPress={() => navigation.goBack()}
              placement="leading"
              theme={theme}
            />
          )),
        })}
      >
        {screen_props => (
          <PublishOptionsScreen
            {...screen_props}
            theme={theme}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

export default observer(SignedInNavigator);
