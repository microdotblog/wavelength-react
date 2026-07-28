const {
  build_discover_lock_screen_metadata,
  DISCOVER_ALBUM_TITLE,
} = require('../lock_screen_metadata');

describe('build_discover_lock_screen_metadata', () => {
  test('maps discover post fields to lock screen metadata', () => {
    expect(
      build_discover_lock_screen_metadata({
        artist_name: 'Paul DeFazio',
        artwork_url: 'https://avatars.micro.blog/avatar.jpg',
        title: 'Conversation post',
      }),
    ).toEqual({
      albumTitle: DISCOVER_ALBUM_TITLE,
      artist: 'Paul DeFazio',
      artworkUrl: 'https://avatars.micro.blog/avatar.jpg',
      title: 'Conversation post',
    });
  });

  test('falls back when title or author are missing', () => {
    expect(build_discover_lock_screen_metadata()).toEqual({
      albumTitle: DISCOVER_ALBUM_TITLE,
      artist: 'Micro.blog',
      title: 'Discover podcast',
    });
  });
});
