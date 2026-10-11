import { Platform } from 'react-native';

import { build_recording_live_activity_props } from './recording_live_activity_props';

const RECORDING_LIVE_ACTIVITY_URL = 'wavelength://record';

let activity_instance = null;
let operation_token = 0;

function next_operation_token() {
  operation_token += 1;
  return operation_token;
}

function get_recording_live_activity_factory() {
  if (Platform.OS !== 'ios') {
    return null;
  }

  // Lazy so Android/tests never evaluate the Live Activity layout module.
  return require('../live_activities/RecordingLiveActivity').default;
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
  } catch {}
}

export async function sync_recording_live_activity({
  duration_ms = 0,
  phase = 'idle',
} = {}) {
  if (Platform.OS !== 'ios') {
    return;
  }

  if (phase !== 'recording' && phase !== 'paused') {
    await end_recording_live_activity();
    return;
  }

  const factory = get_recording_live_activity_factory();

  if (!factory) {
    return;
  }

  const props = build_recording_live_activity_props({
    duration_ms,
    phase,
  });
  const token = next_operation_token();
  const current = activity_instance;

  if (current) {
    await update_instance(current, props);
  } else {
    await start_instance(factory, props, token);
  }
}

async function update_instance(instance, props) {
  try {
    await instance.update(props);
  } catch (error) {
    if (activity_instance === instance) {
      activity_instance = null;
    }

    await end_instance(instance);
  }
}

async function start_instance(factory, props, token) {
  try {
    await end_orphaned_instances(factory);

    if (token !== operation_token) {
      return;
    }

    const started = factory.start(props, RECORDING_LIVE_ACTIVITY_URL);

    if (token !== operation_token) {
      await end_instance(started);
      return;
    }

    activity_instance = started;
  } catch (error) {
    await end_orphaned_instances(factory).catch(() => {});
  }
}

export async function end_recording_live_activity() {
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
    const factory = get_recording_live_activity_factory();
    await end_orphaned_instances(factory);
  } catch {}
}

export function reset_recording_live_activity_for_tests() {
  activity_instance = null;
  operation_token = 0;
}
