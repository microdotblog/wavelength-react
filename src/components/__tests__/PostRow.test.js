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

jest.mock('../PlatformSymbol', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return function PlatformSymbol({ name }) {
    return React.createElement(Text, null, name);
  };
});

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

  test('shows a podcast summary under the title', async () => {
    const { getByText } = await render(
      React.createElement(PostRow, {
        onPress: jest.fn(),
        post: {
          content: '<audio controls src="https://micro.blog/a.m4a"></audio>',
          summary: 'A walk around the lake',
          title: 'Show',
        },
        theme,
      }),
    );

    expect(getByText('A walk around the lake')).toBeTruthy();
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

  test('marks podcast and narrated posts when showing kind', async () => {
    const podcast_row = await render(
      React.createElement(PostRow, {
        onPress: jest.fn(),
        post: {
          content: '<audio controls src="https://micro.blog/a.m4a"></audio>',
          published_at: '2026-06-02T12:00:00Z',
          title: 'Show',
        },
        show_kind: true,
        theme,
      }),
    );

    expect(podcast_row.getByText(/Podcast/)).toBeTruthy();
    expect(podcast_row.getByText('waveform')).toBeTruthy();
    expect(podcast_row.getByLabelText(/Podcast/)).toBeTruthy();

    const narrated_row = await render(
      React.createElement(PostRow, {
        onPress: jest.fn(),
        post: {
          content: '<audio src="https://micro.blog/r.m4a" preload="metadata" style="display: none"></audio><p>Essay</p>',
          title: 'Essay',
        },
        show_kind: true,
        theme,
      }),
    );

    expect(narrated_row.getByText('Narrated')).toBeTruthy();
    expect(narrated_row.getByText('microphone')).toBeTruthy();
    expect(narrated_row.queryByText('Podcast')).toBeNull();
    expect(narrated_row.queryByText('waveform')).toBeNull();
  });

  test('hides kind marks unless showing kind', async () => {
    const { queryByText } = await render(
      React.createElement(PostRow, {
        onPress: jest.fn(),
        post: {
          content: '<audio controls src="https://micro.blog/a.m4a"></audio>',
          title: 'Show',
        },
        theme,
      }),
    );

    expect(queryByText('Podcast')).toBeNull();
    expect(queryByText('Narrated')).toBeNull();
    expect(queryByText('waveform')).toBeNull();
    expect(queryByText('microphone')).toBeNull();
  });
});
