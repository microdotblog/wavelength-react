import React from 'react';
import { Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HeaderPillButton from '../../components/HeaderPillButton';
import HeaderProfileButton from '../../components/HeaderProfileButton';
import RecordingsScreen from '../../screens/RecordingsScreen';
import { build_stack_screen_options } from '../screenOptions';
import {
  header_left_element,
  header_right_element,
  is_liquid_glass,
} from '../../theme/wavelengthTheme';

const Stack = createNativeStackNavigator();

function RecordingsStack({ theme }) {
  const show_header_record_button = Platform.OS === 'ios' && !is_liquid_glass();

  return (
    <Stack.Navigator screenOptions={build_stack_screen_options(theme)}>
      <Stack.Screen
        name="Recordings"
        options={({ navigation }) => ({
          title: 'Recordings',
          ...header_right_element(() => (
            <HeaderProfileButton
              onPress={() => navigation.navigate('Account')}
              theme={theme}
            />
          )),
          ...(show_header_record_button
            ? header_left_element(() => (
                <HeaderPillButton
                  label="Record"
                  onPress={() => navigation.navigate('Record')}
                  theme={theme}
                />
              ))
            : null),
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
