import { Platform } from 'react-native';

import { build_discover_playback_live_activity_props } from './discover_playback_live_activity_props';
import { preload_discover_playback_artwork } from './preload_discover_playback_artwork';

const DISCOVER_PLAYBACK_LIVE_ACTIVITY_URL = 'wavelength://discover';

let activity_instance = null;
let operation_token = 0;

function next_operation_token() {
  operation_token += 1;
  return operation_token;
}

function get_discover_playback_live_activity_factory() {
  if (Platform.OS !== 'ios') {
    return null;
  }

  // Lazy so Android/tests never evaluate the Live Activity layout module.
  return require('../live_activities/DiscoverPlaybackLiveActivity').default;
}

async function end_orphaned_instances(factory) {
  if (!factory?.getInstances) {
    return;
  }

  const instances = factory.getInstances();

  await Promise.all(
    instances.map((instance) =>
      instance.end('immediate').catch(() => {}),
    ),
  );
}

async function end_instance(instance) {
  if (!instance) {
    return;
  }

  try {
    await instance.end('immediate');
  } catch (error) {
    // Already dismissed or unavailable.
  }
}

export async function sync_discover_playback_live_activity({
  artist_name = '',
  artwork_url = '',
  post_id = '',
  remaining_ms = 0,
  title = '',
} = {}) {
  if (Platform.OS !== 'ios') {
    return;
  }

  const factory = get_discover_playback_live_activity_factory();

  if (!factory) {
    return;
  }

  const token = next_operation_token();
  const artwork_uri = await preload_discover_playback_artwork({
    artwork_url,
    post_id,
  });

  if (token !== operation_token) {
    return;
  }

  const props = build_discover_playback_live_activity_props({
    artist_name,
    artwork_uri,
    remaining_ms,
    title,
  });

  try {
    if (!activity_instance) {
      await end_orphaned_instances(factory);

      if (token !== operation_token) {
        return;
      }

      const started = factory.start(props, DISCOVER_PLAYBACK_LIVE_ACTIVITY_URL);

      if (token !== operation_token) {
        await end_instance(started);
        return;
      }

      activity_instance = started;
      return;
    }

    await activity_instance.update(props);
  } catch (error) {
    const failed = activity_instance;
    activity_instance = null;
    await end_instance(failed);
    await end_orphaned_instances(factory).catch(() => {});
  }
}

export async function end_discover_playback_live_activity() {
  next_operation_token();

  if (Platform.OS !== 'ios') {
    activity_instance = null;
    return;
  }

  const current = activity_instance;
  activity_instance = null;

  if (current) {
    await end_instance(current);
    return;
  }

  try {
    const factory = get_discover_playback_live_activity_factory();
    await end_orphaned_instances(factory);
  } catch (error) {
    // No active activity to clean up.
  }
}

export function reset_discover_playback_live_activity_for_tests() {
  activity_instance = null;
  operation_token = 0;
}
