import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HeaderProfileButton from '../../components/HeaderProfileButton';
import RecordingsScreen from '../../screens/RecordingsScreen';
import { build_stack_screen_options } from '../screenOptions';
import { SidebarVisibleContext } from '../TabletLayout';
import { header_left_element } from '../../theme/wavelengthTheme';

const Stack = createNativeStackNavigator();

function RecordingsStack({ theme }) {
  const sidebar_visible = React.useContext(SidebarVisibleContext);

  return (
    <Stack.Navigator screenOptions={build_stack_screen_options(theme)}>
      <Stack.Screen
        name="Recordings"
        options={({ navigation }) => ({
          title: 'Recordings',
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
          <RecordingsScreen
            {...screen_props}
            theme={theme}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

export default RecordingsStack;
