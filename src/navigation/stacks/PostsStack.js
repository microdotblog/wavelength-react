import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import PostsScreen from '../../screens/PostsScreen';
import { build_stack_screen_options } from '../screenOptions';

const Stack = createNativeStackNavigator();

function PostsStack({ theme }) {
  return (
    <Stack.Navigator screenOptions={build_stack_screen_options(theme)}>
      <Stack.Screen
        name="Posts"
        options={{ title: 'Posts', headerLargeTitle: false }}
      >
        {screen_props => (
          <PostsScreen
            {...screen_props}
            theme={theme}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

export default PostsStack;
