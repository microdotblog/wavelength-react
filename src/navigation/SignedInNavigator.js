import React from 'react';
import { Platform, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { observer } from 'mobx-react';

import EditScreen from '../screens/EditScreen';
import HeaderPillButton from '../components/HeaderPillButton';
import NarrateEditScreen from '../screens/NarrateEditScreen';
import NarrateScreen from '../screens/NarrateScreen';
import PostEditScreen from '../screens/PostEditScreen';
import PublishOptionsScreen from '../screens/PublishOptionsScreen';
import PublishScreen from '../screens/PublishScreen';
import DiscoverPlaybackProvider from '../components/DiscoverPlaybackProvider';
import RecordFab from '../components/RecordFab';
import RecordScreen from '../screens/RecordScreen';
import SettingsNavigator from './SettingsNavigator';
import SplitScreen from '../screens/SplitScreen';
import TabNavigator from './TabNavigator';
import TabletLayout from './TabletLayout';
import { build_stack_screen_options } from './screenOptions';
import { header_left_element } from '../theme/wavelengthTheme';

const Stack = createNativeStackNavigator();
const RootStack = createNativeStackNavigator();
const tablet_layout = props => <TabletLayout {...props} />;

function ContentNavigator({ theme }) {
  const is_tablet = Platform.OS === 'ios' && Platform.isPad;

  return (
    <Stack.Navigator
      initialRouteName="MainTabs"
      layout={is_tablet ? tablet_layout : undefined}
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
        name="Record"
        options={({ route }) => ({
          title: route.params?.episode_id || route.params?.narration_post_uid
            ? 'Add Segment'
            : 'New Recording',
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
        options={{
          title: 'Split Segment',
          headerLargeTitle: false,
          unmountOnBlur: true,
        }}
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
        options={{
          title: 'Edit Post',
          headerLargeTitle: false,
        }}
      >
        {screen_props => (
          <PostEditScreen
            {...screen_props}
            theme={theme}
          />
        )}
      </Stack.Screen>
      <Stack.Screen
        name="Narrate"
        options={{
          title: 'Narrate',
          headerLargeTitle: false,
        }}
      >
        {screen_props => (
          <NarrateScreen
            {...screen_props}
            theme={theme}
          />
        )}
      </Stack.Screen>
      <Stack.Screen
        name="NarrateEdit"
        options={{
          title: 'Edit Narration',
          headerLargeTitle: false,
        }}
      >
        {screen_props => (
          <NarrateEditScreen
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
        options={{
          title: 'Options',
          headerLargeTitle: false,
        }}
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

function SignedInNavigator({ theme }) {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="Studio">
        {() => <ContentNavigator theme={theme} />}
      </RootStack.Screen>
      <RootStack.Screen name="Account" options={{ presentation: 'modal' }}>
        {screen_props => <SettingsNavigator {...screen_props} theme={theme} />}
      </RootStack.Screen>
    </RootStack.Navigator>
  );
}

export default observer(SignedInNavigator);
