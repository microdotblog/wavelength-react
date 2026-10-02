import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HeaderProfileButton from '../../components/HeaderProfileButton';
import DiscoverScreen from '../../screens/DiscoverScreen';
import { build_stack_screen_options } from '../screenOptions';
import { SidebarVisibleContext } from '../SidebarContext';
import { header_left_element } from '../../theme/wavelengthTheme';

const Stack = createNativeStackNavigator();

function DiscoverStack({ theme }) {
  const sidebar_visible = React.useContext(SidebarVisibleContext);

  return (
    <Stack.Navigator screenOptions={build_stack_screen_options(theme)}>
      <Stack.Screen
        name="Discover"
        options={({ navigation }) => ({
          title: 'Discover',
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
