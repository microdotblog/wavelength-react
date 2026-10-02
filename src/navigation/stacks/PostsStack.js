import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HeaderProfileButton from '../../components/HeaderProfileButton';
import PostsScreen from '../../screens/PostsScreen';
import { build_stack_screen_options } from '../screenOptions';
import { SidebarVisibleContext } from '../TabletLayout';
import { header_left_element } from '../../theme/wavelengthTheme';

const Stack = createNativeStackNavigator();

function PostsStack({ theme }) {
  const sidebar_visible = React.useContext(SidebarVisibleContext);

  return (
    <Stack.Navigator screenOptions={build_stack_screen_options(theme)}>
      <Stack.Screen
        name="Posts"
        options={({ navigation }) => ({
          title: 'Posts',
          headerLargeTitle: false,
          ...(sidebar_visible
            ? { headerLeft: () => null, unstable_headerLeftItems: () => [] }
            : header_left_element(() => (
                <HeaderProfileButton
                  onPress={() => navigation.navigate('Account')}
                  theme={theme}
                />
              ))),
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
