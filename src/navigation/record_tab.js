export const RECORD_TAB_LABEL = 'Record';

export function ios_record_tab_options() {
  return {
    tabBarLabel: RECORD_TAB_LABEL,
    tabBarIcon: { type: 'sfSymbol', name: 'mic.fill' },
    tabBarSelectionEnabled: false,
  };
}

export function press_record_tab(navigation) {
  navigation.getParent()?.navigate('Record');
}
