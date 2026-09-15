const {
  ios_record_tab_options,
  press_record_tab,
  RECORD_TAB_LABEL,
} = require('../record_tab');

describe('ios_record_tab_options', () => {
  test('uses a microphone tab instead of the search system item', () => {
    const options = ios_record_tab_options();

    expect(options).toEqual({
      tabBarIcon: { name: 'mic.fill', type: 'sfSymbol' },
      tabBarLabel: RECORD_TAB_LABEL,
      tabBarSelectionEnabled: false,
    });
    expect(RECORD_TAB_LABEL).toBe('Record');
    expect(options.tabBarSystemItem).toBeUndefined();
  });
});

describe('press_record_tab', () => {
  test('opens the Record screen on the parent stack', () => {
    const navigate = jest.fn();

    press_record_tab({
      getParent: () => ({ navigate }),
    });

    expect(navigate).toHaveBeenCalledWith('Record');
  });
});
