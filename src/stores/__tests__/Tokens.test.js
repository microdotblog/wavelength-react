const mock_stored_values = new Map();

jest.mock('expo-secure-store', () => ({
  deleteItemAsync: jest.fn(async key => mock_stored_values.delete(key)),
  getItemAsync: jest.fn(async key => mock_stored_values.get(key) || null),
  setItemAsync: jest.fn(async (key, value) => mock_stored_values.set(key, value)),
}));

const Tokens = require('../Tokens').default;

describe('Tokens destination persistence', () => {
  beforeEach(async () => {
    mock_stored_values.clear();
    await Tokens.clear_all();
    await Tokens.set_user_token('token');
  });

  test('persists and restores the selected destination fields', async () => {
    await Tokens.set_selected_destination({
      name: 'example.micro.blog',
      uid: 'https://example.micro.blog/',
    });

    expect(Tokens.get_selected_destination()).toEqual({
      name: 'example.micro.blog',
      uid: 'https://example.micro.blog/',
    });

    const stored_snapshot = JSON.parse(mock_stored_values.get('WavelengthTokens'));

    expect(stored_snapshot.selected_destination_name).toBe('example.micro.blog');
    expect(stored_snapshot.selected_destination_uid).toBe('https://example.micro.blog/');
  });

  test('clears the selected destination when the token is removed', async () => {
    await Tokens.set_selected_destination({
      name: 'example.micro.blog',
      uid: 'https://example.micro.blog/',
    });
    await Tokens.clear_user_token();

    expect(Tokens.get_selected_destination()).toBeNull();
    expect(mock_stored_values.has('WavelengthTokens')).toBe(false);
  });
});
