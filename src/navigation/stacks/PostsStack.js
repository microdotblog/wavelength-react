import React from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { observer } from 'mobx-react';

import HeaderProfileButton from '../../components/HeaderProfileButton';
import PostsScreen from '../../screens/PostsScreen';
import Posts from '../../stores/Posts';
import { build_stack_screen_options } from '../screenOptions';
import {
  header_left_element,
  header_right_element,
} from '../../theme/wavelengthTheme';

const Stack = createNativeStackNavigator();

function PostsStack({ theme }) {
  const show_loading_indicator = !Posts.did_hydrate || Posts.is_loading;

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
          ...(show_loading_indicator
            ? header_right_element(() => (
                <ActivityIndicator
                  color={theme.colors.accent}
                  size="small"
                  style={styles.loadingIndicator}
                />
              ), { hidesSharedBackground: true })
            : null),
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

const styles = StyleSheet.create({
  loadingIndicator: {
    height: 28,
    width: 28,
  },
});

export default observer(PostsStack);
