const {
  apply_text_format_action,
  build_episode_publish_payload,
  normalize_micropub_categories,
  normalize_micropub_syndicates,
  resolve_playback_toggle_action,
  seek_seconds_from_fraction,
  should_show_title,
  toggle_list_item,
} = require('../publish_editor');

describe('publish_editor', () => {
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