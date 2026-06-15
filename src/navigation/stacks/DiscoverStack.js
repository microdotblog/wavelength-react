import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import DiscoverScreen from '../../screens/DiscoverScreen';
import { build_stack_screen_options } from '../screenOptions';

const Stack = createNativeStackNavigator();

function DiscoverStack({ theme }) {
  return (
    <Stack.Navigator screenOptions={build_stack_screen_options(theme)}>
      <Stack.Screen
        name="Discover"
        options={{ title: 'Discover' }}
      >
        {screen_props => (
          <DiscoverScreen
            {...screen_props}
            theme={theme}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

export default DiscoverStack;
