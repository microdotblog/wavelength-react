const {
  apply_text_format_action,
  build_episode_audio_filename,
  build_episode_publish_payload,
  has_publishable_post_text,
  normalize_micropub_categories,
  normalize_micropub_syndicates,
  resolve_playback_toggle_action,
  resolve_publish_progress,
  seek_seconds_from_fraction,
  should_show_title,
  toggle_list_item,
} = require('../publish_editor');

describe('publish_editor', () => {
  test('has_publishable_post_text requires content or summary', () => {
    expect(has_publishable_post_text()).toBe(false);
    expect(has_publishable_post_text({ content: '   ', summary: '' })).toBe(false);
    expect(has_publishable_post_text({ content: 'Show notes' })).toBe(true);
    expect(has_publishable_post_text({ summary: 'Episode summary' })).toBe(true);
  });

  test('should_show_title when show_title is enabled', () => {
    expect(should_show_title({ show_title: true })).toBe(true);
  });

  test('should_show_title when content exceeds max length', () => {
    expect(should_show_title({ content_length: 281 })).toBe(true);
  });

  test('apply_text_format_action wraps bold selection', () => {
    const result = apply_text_format_action('hello world', { end: 5, start: 0 }, 'bold');

    expect(result.text).toBe('**hello** world');
    expect(result.selection).toEqual({ end: 9, start: 9 });
  });

  test('toggle_list_item adds and removes values', () => {
    expect(toggle_list_item([], 'podcast')).toEqual(['podcast']);
    expect(toggle_list_item(['podcast'], 'podcast')).toEqual([]);
  });

  test('build_episode_audio_filename creates a clean MP3 filename from the title', () => {
    expect(build_episode_audio_filename('Episode 123: Hello')).toBe('episode-123-hello.mp3');
    expect(build_episode_audio_filename("Café's  summer show!")).toBe('cafes-summer-show.mp3');
    expect(build_episode_audio_filename('')).toBe('exported.mp3');
  });

  test('build_episode_publish_payload trims and normalizes fields', () => {
    const payload = build_episode_publish_payload({
      audio_url: ' https://micro.blog/audio.m4a ',
      categories: [' microcast ', '', 'news'],
      content: '  Show notes  ',
      destination: ' https://example.micro.blog ',
      status: ' draft ',
      summary: '  Summary text  ',
      title: '  Episode title  ',
    });

    expect(payload).toEqual({
      audio_url: 'https://micro.blog/audio.m4a',
      categories: ['microcast', 'news'],
      content: 'Show notes',
      destination: 'https://example.micro.blog',
      status: 'draft',
      summary: 'Summary text',
      syndicates: [],
      title: 'Episode title',
    });
  });

  test('resolve_playback_toggle_action returns play or pause', () => {
    expect(resolve_playback_toggle_action(false)).toBe('play');
    expect(resolve_playback_toggle_action(true)).toBe('pause');
  });

  test('resolve_publish_progress maps publishing phases to progress values', () => {
    expect(resolve_publish_progress('exporting')).toBe(0.25);
    expect(resolve_publish_progress('uploading')).toBe(0.6);
    expect(resolve_publish_progress('posting')).toBe(0.9);
    expect(resolve_publish_progress('done')).toBe(1);
    expect(resolve_publish_progress('idle')).toBe(0);
  });

  test('seek_seconds_from_fraction converts waveform scrub fraction', () => {
    expect(seek_seconds_from_fraction(0.5, 120)).toBe(60);
    expect(seek_seconds_from_fraction(1.5, 120)).toBe(120);
  });

  test('normalize_micropub_categories reads categories array', () => {
    expect(normalize_micropub_categories({ categories: [' microcast ', 'news'] }))
      .toEqual(['microcast', 'news']);
  });

  test('normalize_micropub_syndicates reads syndicate targets', () => {
    expect(normalize_micropub_syndicates({
      'syndicate-to': [{ name: 'Twitter', uid: 'twitter' }],
    })).toEqual([{ name: 'Twitter', uid: 'twitter' }]);
  });

  test('build_episode_publish_payload includes syndicates', () => {
    const payload = build_episode_publish_payload({
      summary: 'Short summary',
      syndicates: ['twitter'],
      title: 'Episode',
    });

    expect(payload.syndicates).toEqual(['twitter']);
    expect(payload.summary).toBe('Short summary');
  });
});
