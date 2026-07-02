export function safe_player_side_effect(player = null, action = null) {
  if (!player || typeof action !== 'function') {
    return false;
  }

  try {
    action();
    return true;
  } catch {
    return false;
  }
}