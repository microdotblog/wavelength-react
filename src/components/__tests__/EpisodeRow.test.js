jest.mock('react-native', () => ({
  Platform: { OS: 'ios', select: options => options.ios ?? options.default },
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

jest.mock('@react-native-menu/menu', () => ({
  MenuView: ({ children }) => children,
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
const EpisodeRow = require('../EpisodeRow').default;

const theme = {
  colors: {
    accent_strong: '#ff8800',
    glass: 'rgba(255, 255, 255, 0.78)',
    ink: '#24180d',
    ink_soft: '#756657',
    line: 'rgba(255, 136, 0, 0.2)',
  },
  is_dark: false,
};

function episode(overrides = {}) {
  return {
    created_at: '2026-06-01T12:00:00Z',
    duration_seconds: 20,
    is_published: () => false,
    post_id: null,
    post_url: null,
    published_at: null,
    title: 'Testing',
    ...overrides,
  };
}

describe('EpisodeRow', () => {
  test('shows a timestamp for unpublished and published episodes', async () => {
    const draft = await render(
      React.createElement(EpisodeRow, {
        episode: episode(),
        theme,
      }),
    );

    expect(draft.getByText(/1 Jun 2026/)).toBeTruthy();
    expect(draft.queryByText('Podcast')).toBeNull();
    expect(draft.queryByText('waveform')).toBeNull();

    const published = await render(
      React.createElement(EpisodeRow, {
        episode: episode({
          is_published: () => true,
          published_at: '2026-09-03T18:56:00Z',
        }),
        theme,
      }),
    );

    expect(published.getByText(/3 Sept? 2026/)).toBeTruthy();
    expect(published.getByText('Published')).toBeTruthy();
  });

  test('shows a linked post summary under the title', async () => {
    const { getByText } = await render(
      React.createElement(EpisodeRow, {
        episode: episode({
          is_published: () => true,
          published_at: '2026-09-03T18:56:00Z',
        }),
        summary: 'A walk around the lake',
        theme,
      }),
    );

    expect(getByText('A walk around the lake')).toBeTruthy();
  });

  test('marks podcasts when showing kind', async () => {
    const { getByText, queryByText } = await render(
      React.createElement(EpisodeRow, {
        episode: episode({
          is_published: () => true,
          published_at: '2026-09-03T18:56:00Z',
        }),
        show_kind: true,
        theme,
      }),
    );

    expect(getByText('Podcast')).toBeTruthy();
    expect(getByText('waveform')).toBeTruthy();
    expect(queryByText('Narrated')).toBeNull();
  });
});
