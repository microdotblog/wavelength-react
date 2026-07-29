jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

const { parse_legacy_episode_plist } = require('../EpisodeStorage');

describe('parse_legacy_episode_plist', () => {
  test('reads the legacy title and ordered clip filenames', () => {
    const plist = `<?xml version="1.0" encoding="UTF-8"?>
      <plist version="1.0">
        <dict>
          <key>clips</key>
          <array>
            <string>2024-03-13 12:34:56.caf</string>
            <string>second-segment.m4a</string>
          </array>
          <key>title</key>
          <string>News &amp; Notes</string>
        </dict>
      </plist>`;

    expect(parse_legacy_episode_plist(plist)).toEqual({
      clips: [
        '2024-03-13 12:34:56.caf',
        'second-segment.m4a',
      ],
      title: 'News & Notes',
    });
  });

  test('ignores unsafe clip paths', () => {
    const plist = `
      <plist version="1.0">
        <dict>
          <key>title</key>
          <string>Legacy recording</string>
          <key>clips</key>
          <array>
            <string>segment.m4a</string>
            <string>../outside.m4a</string>
            <string>folder/inside.m4a</string>
          </array>
        </dict>
      </plist>`;

    expect(parse_legacy_episode_plist(plist).clips).toEqual(['segment.m4a']);
  });
});
