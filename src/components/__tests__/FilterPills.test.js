jest.mock('react-native', () => ({
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: {
    create: styles => styles,
    flatten: style => {
      if (Array.isArray(style)) {
        return Object.assign({}, ...style.filter(Boolean));
      }

      return style || {};
    },
    hairlineWidth: 1,
  },
  Text: 'Text',
  View: 'View',
}));

const React = require('react');
const { fireEvent, render } = require('@testing-library/react-native');
const FilterPills = require('../FilterPills').default;

const theme = {
  colors: {
    accent: '#ff8800',
    button_text: '#ffffff',
    glass: 'rgba(255, 255, 255, 0.78)',
    ink: '#24180d',
    line: 'rgba(255, 136, 0, 0.2)',
  },
};

describe('FilterPills', () => {
  test('renders the post kind filters and reports the selected pill', async () => {
    const on_select = jest.fn();
    const { getByLabelText, getByText } = await render(
      React.createElement(FilterPills, {
        on_select,
        selected_id: 'podcasts',
        theme,
      }),
    );

    expect(getByText('All')).toBeTruthy();
    expect(getByText('Posts')).toBeTruthy();
    expect(getByText('Podcasts')).toBeTruthy();
    expect(getByText('Narrated')).toBeTruthy();
    expect(getByLabelText('Filter posts: Podcasts').props.accessibilityState.selected).toBe(true);

    fireEvent.press(getByLabelText('Filter posts: Narrated'));
    expect(on_select).toHaveBeenCalledWith('narrated');
  });
});
