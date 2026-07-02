import React from 'react';
import { Platform, View } from 'react-native';
import { createNativeBottomTabNavigator } from '@react-navigation/bottom-tabs/unstable';

import DiscoverStack from './stacks/DiscoverStack';
import PostsStack from './stacks/PostsStack';
import RecordingsStack from './stacks/RecordingsStack';
import { is_liquid_glass } from '../theme/wavelengthTheme';

const RECORDINGS_ICON = require('../../assets/icons/tab_bar/recordings.png');
const POSTS_ICON = require('../../assets/icons/tab_bar/posts.png');
const DISCOVER_ICON = require('../../assets/icons/tab_bar/discover.png');

const Tab = createNativeBottomTabNavigator();

const TAB_ICONS = {
  RecordingsStack: {
    ios: { default: 'waveform', selected: 'waveform' },
    image: RECORDINGS_ICON,
  },
  PostsStack: {
    ios: { default: 'doc.text', selected: 'doc.text' },
    image: POSTS_ICON,
  },
  DiscoverStack: {
    ios: { default: 'globe', selected: 'globe' },
    image: DISCOVER_ICON,
  },
};

function tab_icon(route_name) {
  return ({ focused }) => {
    const icon = TAB_ICONS[route_name];

    if (Platform.OS === 'ios') {
      return {
        type: 'sfSymbol',
        name: focused ? icon.ios.selected : icon.ios.default,
      };
    }

    return { type: 'image', source: icon.image };
  };
}

function RecordActionScreen() {
  return <View style={{ flex: 1 }} />;
}

function TabNavigator({ theme }) {
  const show_record_action = Platform.OS === 'ios' && is_liquid_glass();

  return (
    <Tab.Navigator
      initialRouteName="RecordingsStack"
      screenOptions={{
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.ink_soft,
        ...(Platform.OS === 'ios'
          ? { tabBarMinimizeBehavior: 'onScrollDown' }
          : {
              tabBarStyle: {
                backgroundColor: theme.colors.canvas,
              },
            }),
      }}
    >
      <Tab.Screen
        name="RecordingsStack"
        options={{
          tabBarLabel: 'Recordings',
          tabBarIcon: tab_icon('RecordingsStack'),
        }}
      >
        {screen_props => (
          <RecordingsStack
            {...screen_props}
            theme={theme}
          />
        )}
      </Tab.Screen>
      <Tab.Screen
        name="PostsStack"
        options={{
          tabBarLabel: 'Posts',
          tabBarIcon: tab_icon('PostsStack'),
        }}
      >
        {screen_props => (
          <PostsStack
            {...screen_props}
            theme={theme}
          />
        )}
      </Tab.Screen>
      <Tab.Screen
        name="DiscoverStack"
        options={{
          tabBarLabel: 'Discover',
          tabBarIcon: tab_icon('DiscoverStack'),
        }}
      >
        {screen_props => (
          <DiscoverStack
            {...screen_props}
            theme={theme}
          />
        )}
      </Tab.Screen>
      {show_record_action ? (
        <Tab.Screen
          name="RecordAction"
          component={RecordActionScreen}
          options={{
            tabBarSystemItem: 'search',
            tabBarLabel: 'Record',
            tabBarIcon: { type: 'sfSymbol', name: 'mic.fill' },
            tabBarSelectionEnabled: false,
          }}
          listeners={({ navigation }) => ({
            tabPress: () => {
              navigation.getParent()?.navigate('Record');
            },
          })}
        />
      ) : null}
    </Tab.Navigator>
  );
}

export default TabNavigator;
