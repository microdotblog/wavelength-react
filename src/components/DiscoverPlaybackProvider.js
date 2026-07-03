import React from 'react';
import { LayoutAnimation, Linking, StyleSheet } from 'react-native';
import { observer } from 'mobx-react';
import Animated, { Easing, FadeInDown, FadeOutDown } from 'react-native-reanimated';

import DiscoverPlaybackToolbar from './DiscoverPlaybackToolbar';
import { use_discover_playback } from '../hooks/use_discover_playback';
import { use_tab_bar_bottom_offset } from '../hooks/use_tab_bar_bottom_offset';
import {
  is_playable_discover_post,
  resolve_discover_playback_artwork_url,
} from '../lib/discover_posts';
import { android_record_fab_reserved_width } from '../lib/tab_bar_inset';
import { seek_seconds_from_fraction } from '../lib/publish_editor';
import Discover from '../stores/Discover';

export const PLAYBACK_DOCK_GAP = 10;
export const PLAYBACK_DOCK_HEIGHT = 80;
const PLAYBACK_DOCK_HORIZONTAL_INSET = 16;

const PLAYBACK_DOCK_ENTERING = FadeInDown.springify()
  .damping(22)
  .mass(0.75)
  .stiffness(260);
const PLAYBACK_DOCK_EXITING = FadeOutDown.duration(240).easing(Easing.in(Easing.cubic));

const DiscoverPlaybackContext = React.createContext(null);

export function use_discover_playback_dock() {
  return React.useContext(DiscoverPlaybackContext);
}

export function discover_playback_content_padding({
  default_padding = 36,
  has_active_playback = false,
  tab_bar_height = 0,
} = {}) {
  if (!has_active_playback) {
    return default_padding;
  }

  return tab_bar_height + PLAYBACK_DOCK_HEIGHT + PLAYBACK_DOCK_GAP + 24;
}

function DiscoverPlaybackProvider({ children, theme }) {
  const active_post = Discover.active_post();
  const tab_bar_height = use_tab_bar_bottom_offset();
  const should_play = Boolean(active_post);
  const playback_artwork_url = resolve_discover_playback_artwork_url({
    author_avatar: active_post?.author_avatar || '',
    image_url: active_post?.image_url || '',
  });

  const playback = use_discover_playback({
    artist_name: active_post?.author_name || '',
    artwork_url: playback_artwork_url,
    audio_url: active_post?.audio_url || '',
    duration_seconds: active_post?.duration_seconds || 0,
    should_play,
    title: active_post?.title || '',
  });

  const has_active_playback = Boolean(active_post);
  const playback_dock_offset = has_active_playback
    ? tab_bar_height + PLAYBACK_DOCK_GAP
    : 0;
  const playback_dock_right_inset = PLAYBACK_DOCK_HORIZONTAL_INSET + android_record_fab_reserved_width();

  React.useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [has_active_playback]);

  function open_post(post) {
    const post_url = `${post?.url || ''}`.trim();

    if (post_url) {
      Linking.openURL(post_url);
    }
  }

  function handle_play_press(post) {
    if (!is_playable_discover_post(post)) {
      return;
    }

    if (Discover.active_post_id === post.id) {
      if (playback.playing || playback.is_buffering) {
        playback.pause();
      } else {
        playback.play();
      }
      return;
    }

    Discover.play_post(post.id);
  }

  function handle_toggle_playback(action = 'play') {
    if (action === 'pause') {
      playback.pause();
    } else {
      playback.play();
    }
  }

  function handle_seek(fraction = 0) {
    playback.seek(seek_seconds_from_fraction(fraction, playback.duration_seconds));
  }

  function handle_close_playback() {
    playback.pause();
    Discover.clear_playback();
  }

  return (
    <DiscoverPlaybackContext.Provider
      value={{
        active_post,
        active_post_id: Discover.active_post_id,
        handle_play_press,
        has_active_playback,
        playback,
      }}
    >
      {children}
      {active_post ? (
        <Animated.View
          entering={PLAYBACK_DOCK_ENTERING}
          exiting={PLAYBACK_DOCK_EXITING}
          pointerEvents="box-none"
          style={[
            styles.playbackDock,
            {
              bottom: playback_dock_offset,
              left: PLAYBACK_DOCK_HORIZONTAL_INSET,
              right: playback_dock_right_inset,
            },
          ]}
        >
          <DiscoverPlaybackToolbar
            artwork_url={playback_artwork_url}
            author_name={active_post.author_name}
            current_time={playback.current_time}
            duration_seconds={playback.duration_seconds}
            is_buffering={playback.is_buffering}
            is_playing={playback.playing}
            on_close={handle_close_playback}
            on_open_post={() => open_post(active_post)}
            on_seek={handle_seek}
            on_toggle_playback={handle_toggle_playback}
            post_title={active_post.title}
            theme={theme}
          />
        </Animated.View>
      ) : null}
    </DiscoverPlaybackContext.Provider>
  );
}

const styles = StyleSheet.create({
  playbackDock: {
    position: 'absolute',
  },
});

export default observer(DiscoverPlaybackProvider);