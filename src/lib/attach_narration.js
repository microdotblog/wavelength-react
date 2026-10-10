import { Platform } from 'react-native';

import {
  fetch_micropub_post_source,
  update_micropub_post,
  upload_episode_audio,
} from '../api/Micropub';
import { apply_narration_html } from './narration';
import { read_file_size_bytes } from './EpisodeStorage';
import { delete_audio_file, export_episode_mp3 } from './episode_audio';
import { build_upload_size_limit_message, is_over_upload_limit } from './episode_upload_size';

export async function attach_narration_to_post({
  token = '',
  destination = '',
  post_url = '',
  file_uri = '',
  file_name = '',
} = {}) {
  const upload_uri = Platform.OS === 'ios' ? await export_episode_mp3(file_uri) : file_uri;
  let audio_url;

  try {
    const upload_size = read_file_size_bytes(upload_uri);
    if (is_over_upload_limit(upload_size)) {
      throw new Error(build_upload_size_limit_message(upload_size, 'narration'));
    }

    audio_url = await upload_episode_audio({
      destination,
      file_name: Platform.OS === 'ios' ? file_name.replace(/\.m4a$/i, '.mp3') : file_name,
      file_uri: upload_uri,
      token,
    });
  } finally {
    if (upload_uri !== file_uri) {
      delete_audio_file(upload_uri);
    }
  }

  const source = await fetch_micropub_post_source({ destination, post_url, token });

  if (!source) {
    throw new Error('We could not load this post to add narration.');
  }

  const content = apply_narration_html(source.content, audio_url);

  await update_micropub_post({
    audio_url,
    categories: source.categories,
    content,
    destination,
    post_url,
    status: source.post_status,
    summary: source.summary,
    title: source.title,
    token,
  });

  return { audio_url, content };
}

export async function remove_narration_from_post({
  token = '',
  destination = '',
  post_url = '',
} = {}) {
  const source = await fetch_micropub_post_source({ destination, post_url, token });

  if (!source) {
    throw new Error('We could not load this post to remove narration.');
  }

  const content = apply_narration_html(source.content, '');

  await update_micropub_post({
    categories: source.categories,
    content,
    destination,
    post_url,
    status: source.post_status,
    summary: source.summary,
    title: source.title,
    token,
  });

  return { content };
}
