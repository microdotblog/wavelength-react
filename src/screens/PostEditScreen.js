import React from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { observer } from 'mobx-react';

import Episodes from '../stores/Episodes';
import EditorKeyboardAvoidingView from '../components/EditorKeyboardAvoidingView';
import EpisodeAttachmentToolbar from '../components/EpisodeAttachmentToolbar';
import HighlightingText from '../components/text/HighlightingText';
import HeaderPillButton from '../components/HeaderPillButton';
import PublishPostToolbar from '../components/PublishPostToolbar';
import Posts from '../stores/Posts';
import Publishing from '../stores/Publishing';
import { use_episode_playback } from '../hooks/use_episode_playback';
import { use_stack_top_inset } from '../hooks/use_stack_top_inset';
import { show_toast } from '../lib/toast';
import { header_right_element } from '../theme/wavelengthTheme';

const EDITOR_REVEAL_DELAY_MS = 700;

function build_ios_post_edit_header_items({ is_updating, on_update }) {
  return [
    {
      accessibilityLabel: 'Update post on Micro.blog',
      disabled: is_updating,
      label: is_updating ? 'Updating…' : 'Update',
      onPress: on_update,
      type: 'button',
      variant: 'done',
    },
  ];
}

function PostEditScreen({ navigation, route, theme }) {
  const post_uid = route.params?.post_uid;
  const episode_id = route.params?.episode_id;
  const post = Posts.get_post(post_uid);
  const episode = Publishing.editor_episode_id
    ? Episodes.get_episode(Publishing.editor_episode_id)
    : null;
  const playback = use_episode_playback(episode ? episode.playback_clips() : []);
  const top_inset = use_stack_top_inset();
  const text_editor_ref = React.useRef(null);
  const update_handler_ref = React.useRef(null);
  const pause_playback_ref = React.useRef(playback.pause);
  const editor_ready_ref = React.useRef(false);
  const reveal_timeout_ref = React.useRef(null);
  const is_mounted_ref = React.useRef(true);
  const [editor_is_visible, set_editor_is_visible] = React.useState(false);

  pause_playback_ref.current = playback.pause;

  function focus_editor() {
    if (!is_mounted_ref.current) {
      return;
    }

    const run_focus = () => {
      text_editor_ref.current?.focus({ cursorToEnd: true });
    };

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(run_focus);
      return;
    }

    run_focus();
  }

  function try_focus_editor() {
    if (!editor_ready_ref.current || !editor_is_visible) {
      return;
    }

    focus_editor();
  }

  function handle_editor_ready() {
    editor_ready_ref.current = true;
    try_focus_editor();
  }

  React.useEffect(() => {
    is_mounted_ref.current = true;
    editor_ready_ref.current = false;
    set_editor_is_visible(false);
    Publishing.reset();

    let cancelled = false;
    const reveal_delay = new Promise(resolve => {
      reveal_timeout_ref.current = setTimeout(resolve, EDITOR_REVEAL_DELAY_MS);
    });

    async function load_editor() {
      await Promise.all([Episodes.refresh(), Posts.refresh()]);

      if (cancelled) {
        return;
      }

      const current_post = Posts.get_post(post_uid);

      if (!current_post) {
        return;
      }

      Publishing.prep_post_edit(current_post, { episode_id });
      try {
        await Publishing.load_post_source();
      } catch {
        // Keep the locally cached post editable when the source request fails.
      }

      await reveal_delay;

      if (cancelled) {
        return;
      }

      set_editor_is_visible(true);
      await Publishing.load_editor_options();
    }

    load_editor();

    return () => {
      cancelled = true;
      is_mounted_ref.current = false;

      if (reveal_timeout_ref.current) {
        clearTimeout(reveal_timeout_ref.current);
      }

      Publishing.reset();
      Publishing.reset_editor();
    };
  }, [post_uid, episode_id]);

  React.useEffect(() => {
    try_focus_editor();
  }, [editor_is_visible]);

  React.useEffect(() => {
    const unsubscribe = navigation.addListener('blur', () => {
      pause_playback_ref.current();
    });

    return unsubscribe;
  }, [navigation]);

  async function handle_update() {
    if (!post || Publishing.is_publishing) {
      return;
    }

    playback.pause();
    const updated = await Publishing.update_post();

    if (!updated) {
      show_toast(Publishing.error_message || 'Update failed. Please try again.');
      return;
    }

    show_toast('Post updated.');
    navigation.goBack();
  }

  function handle_toggle_playback(action = 'play') {
    if (action === 'pause') {
      playback.pause();
      return;
    }

    playback.play();
  }

  function handle_seek(fraction = 0) {
    const basis = playback.total_duration > 0 ? playback.total_duration : 0;

    if (basis <= 0) {
      return;
    }

    playback.seek(fraction * basis);
  }

  function open_episode() {
    if (!episode) {
      return;
    }

    navigation.navigate('Edit', { episode_id: episode.id });
  }

  update_handler_ref.current = handle_update;

  React.useLayoutEffect(() => {
    if (Platform.OS === 'ios') {
      navigation.setOptions({
        headerRight: undefined,
        title: 'Edit Post',
        unstable_headerRightItems: () =>
          build_ios_post_edit_header_items({
            is_updating: Publishing.is_publishing,
            on_update: () => update_handler_ref.current?.(),
          }),
      });
      return;
    }

    navigation.setOptions({
      title: 'Edit Post',
      unstable_headerRightItems: undefined,
      ...header_right_element(() => (
        <HeaderPillButton
          accessibilityLabel="Update post on Micro.blog"
          disabled={Publishing.is_publishing}
          label={Publishing.is_publishing ? 'Updating…' : 'Update'}
          onPress={() => update_handler_ref.current?.()}
          theme={theme}
        />
      )),
    });
  }, [navigation, theme, Publishing.is_publishing]);

  if (!post) {
    return (
      <View style={[styles.screen, styles.missingScreen, { backgroundColor: theme.colors.canvas }]}>
        <Text style={[styles.missingText, { color: theme.colors.ink_soft }]}>
          This post is no longer available.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.canvas }]}>
      <EditorKeyboardAvoidingView
        pointerEvents={editor_is_visible ? 'auto' : 'none'}
        style={[
          styles.editorArea,
          top_inset > 0 ? { paddingTop: top_inset } : null,
          !editor_is_visible ? styles.editorHidden : null,
        ]}
      >
        {Publishing.should_show_title() ? (
          <TextInput
            accessibilityLabel="Post title"
            editable={!Publishing.is_publishing}
            keyboardAppearance={theme.is_dark ? 'dark' : 'light'}
            onChangeText={Publishing.set_post_title}
            placeholder="Title"
            placeholderTextColor={theme.colors.ink_soft}
            selectionColor={theme.colors.accent}
            style={[
              styles.titleInput,
              {
                backgroundColor: theme.colors.canvas,
                borderBottomColor: theme.colors.line,
                color: theme.colors.ink,
              },
            ]}
            value={Publishing.post_title}
          />
        ) : null}

        <HighlightingText
          accessibilityLabel="Show notes"
          bottomOverlayHeight={episode ? 180 : 120}
          editable={!Publishing.is_publishing}
          onReady={handle_editor_ready}
          onChangeText={({ nativeEvent: { text } }) => {
            if (!Publishing.is_publishing) {
              Publishing.set_post_content(text);
            }
          }}
          onSelectionChange={({ nativeEvent: { selection } }) => {
            Publishing.set_text_selection(selection);
          }}
          ref={text_editor_ref}
          scrollEnabled
          selection={{
            end: Publishing.text_selection_end,
            start: Publishing.text_selection_start,
          }}
          style={[
            styles.contentInput,
            {
              backgroundColor: theme.colors.canvas,
              color: theme.colors.ink,
              paddingBottom: episode ? 180 : 120,
            },
          ]}
          theme={theme}
          value={Publishing.post_content}
        />
      </EditorKeyboardAvoidingView>

      <KeyboardStickyView>
        <View style={styles.stickyArea}>
          {episode ? (
            <EpisodeAttachmentToolbar
              current_time={playback.current_time}
              duration_seconds={playback.total_duration || episode.duration_seconds}
              episode_title={episode.title}
              is_playing={playback.playing}
              is_publishing={Publishing.is_publishing}
              on_open_episode={open_episode}
              on_seek={handle_seek}
              on_toggle_playback={handle_toggle_playback}
              theme={theme}
              waveform={episode.waveform}
            />
          ) : null}
          <PublishPostToolbar
            navigation={navigation}
            theme={theme}
          />
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const styles = StyleSheet.create({
  contentInput: {
    flex: 1,
    fontSize: 18,
    minHeight: 300,
    padding: 13,
  },
  editorArea: {
    flex: 1,
  },
  editorHidden: {
    opacity: 0,
  },
  missingScreen: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  missingText: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    textAlign: 'center',
  },
  screen: {
    flex: 1,
  },
  stickyArea: {
    paddingBottom: 8,
    paddingHorizontal: 12,
  },
  titleInput: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
    minHeight: 56,
    padding: 13,
  },
});

export default observer(PostEditScreen);
