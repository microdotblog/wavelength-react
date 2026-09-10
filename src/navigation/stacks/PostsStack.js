import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HeaderProfileButton from '../../components/HeaderProfileButton';
import PostsScreen from '../../screens/PostsScreen';
import { build_stack_screen_options } from '../screenOptions';
import { header_left_element } from '../../theme/wavelengthTheme';

const Stack = createNativeStackNavigator();

function PostsStack({ theme }) {
  return (
    <Stack.Navigator screenOptions={build_stack_screen_options(theme)}>
      <Stack.Screen
        name="Posts"
        options={({ navigation }) => ({
          title: 'Posts',
          headerLargeTitle: false,
          ...header_left_element(() => (
            <HeaderProfileButton
              onPress={() => navigation.navigate('Account')}
              theme={theme}
            />
          )),
        })}
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
