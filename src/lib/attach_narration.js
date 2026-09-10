import {
  fetch_micropub_post_source,
  update_micropub_post,
  upload_episode_audio,
} from '../api/Micropub';
import { apply_narration_html } from './narration';

export async function attach_narration_to_post({
  token = '',
  destination = '',
  post_url = '',
  file_uri = '',
  file_name = '',
} = {}) {
  const audio_url = await upload_episode_audio({
    destination,
    file_name,
    file_uri,
    token,
  });
  const source = await fetch_micropub_post_source({ destination, post_url, token });

  if (!source) {
    throw new Error('We could not load this post to add narration.');
  }

  const content = apply_narration_html(source.content, audio_url);

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

  return { audio_url, content };
}
