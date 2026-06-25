jest.mock('../Auth', () => ({
  __esModule: true,
  default: {
    default_site: 'https://test.micro.blog',
  },
}));

jest.mock('../Episodes', () => ({
  __esModule: true,
  default: {
    export_merged_audio: jest.fn(),
    get_episode: jest.fn(),
  },
}));

jest.mock('../Tokens', () => ({
  __esModule: true,
  default: {
    get_user_token: jest.fn(() => 'token'),
  },
}));

jest.mock('../../api/Micropub', () => ({
  create_episode_post: jest.fn(),
  fetch_micropub_categories: jest.fn(async () => ({ categories: ['microcast'] })),
  fetch_micropub_syndicate_targets: jest.fn(async () => ({
    'syndicate-to': [{ name: 'Twitter', uid: 'twitter' }],
  })),
  upload_episode_audio: jest.fn(),
}));

const Publishing = require('../Publishing').default;

describe('Publishing store', () => {
  beforeEach(() => {
    Publishing.reset();
    Publishing.reset_editor();
  });

  test('handle_text_action applies formatting to post_content', () => {
    Publishing.set_post_content('hello world');
    Publishing.set_text_selection({ end: 5, start: 0 });
    Publishing.handle_text_action('bold');

    expect(Publishing.post_content).toBe('**hello** world');
    expect(Publishing.text_selection_start).toBe(9);
    expect(Publishing.text_selection_end).toBe(9);
  });

  test('handle_post_status_select updates draft status and button label', () => {
    Publishing.handle_post_status_select('draft');

    expect(Publishing.post_status).toBe('draft');
    expect(Publishing.post_button_label()).toBe('Save');
  });

  test('handle_post_category_select toggles categories', () => {
    Publishing.handle_post_category_select('microcast');
    Publishing.handle_post_category_select('microcast');

    expect(Publishing.post_categories).toEqual([]);
  });

  test('load_editor_options populates categories and syndicates', async () => {
    await Publishing.load_editor_options();

    expect(Publishing.available_categories).toEqual(['microcast']);
    expect(Publishing.available_syndicates).toEqual([{ name: 'Twitter', uid: 'twitter' }]);
  });
});