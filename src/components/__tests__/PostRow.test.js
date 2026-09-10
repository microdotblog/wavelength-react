jest.mock('react-native', () => ({
  Pressable: 'Pressable',
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

jest.mock('mobx-react', () => ({
  observer: component => component,
}));

const React = require('react');
const { render } = require('@testing-library/react-native');
const PostRow = require('../PostRow').default;

const theme = {
  colors: {
    glass: 'rgba(255, 255, 255, 0.78)',
    ink: '#24180d',
    ink_soft: '#756657',
    line: 'rgba(255, 136, 0, 0.2)',
  },
};

describe('PostRow', () => {
  test('uses the first line of text when the post has no title', async () => {
    const { getByLabelText, queryByText } = await render(
      React.createElement(PostRow, {
        onPress: jest.fn(),
        post: {
          content: '<p>A walk around the lake</p>',
          title: '',
        },
        theme,
      }),
    );

    expect(getByLabelText('A walk around the lake')).toBeTruthy();
    expect(queryByText('Podcast')).toBeNull();
  });

  test('hints narrate for text posts and edit for podcasts', async () => {
    const text_row = await render(
      React.createElement(PostRow, {
        onPress: jest.fn(),
        post: { content: '<p>Hello</p>', title: 'Note' },
        theme,
      }),
    );

    expect(text_row.getByLabelText('Note').props.accessibilityHint).toBe(
      'Swipe left to delete. Double tap to narrate.',
    );

    const podcast_row = await render(
      React.createElement(PostRow, {
        onPress: jest.fn(),
        post: {
          content: '<audio controls src="https://micro.blog/a.m4a"></audio>',
          title: 'Show',
        },
        theme,
      }),
    );

    expect(podcast_row.getByLabelText('Show').props.accessibilityHint).toBe(
      'Swipe left to delete. Double tap to edit.',
    );
  });
});
