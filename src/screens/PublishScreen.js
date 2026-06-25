import React from 'react';
import {
  ActivityIndicator,
  Alert,
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
import Publishing from '../stores/Publishing';
import { use_episode_playback } from '../hooks/use_episode_playback';
import { use_stack_top_inset } from '../hooks/use_stack_top_inset';
import { header_right_element } from '../theme/wavelengthTheme';

const EDITOR_REVEAL_DELAY_MS = 700;

function build_ios_publish_header_items({ is_publishing, on_post, post_label }) {
  return [
    {
      accessibilityLabel: 'Post episode to Micro.blog',
      disabled: is_publishing,
      label: is_publishing ? 'Posting…' : post_label,
      onPress: on_post,
      type: 'button',
      variant: 'done',
    },
  ];
}

function PublishScreen({ navigation, route, theme }) {
  const episode_id = route.params?.episode_id;
  const episode = Episodes.get_episode(episode_id);
  const playback = use_episode_playback(episode ? episode.playback_clips() : []);
  const top_inset = use_stack_top_inset();
  const text_editor_ref = React.useRef(null);
  const post_handler_ref = React.useRef(null);
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
    Publishing.prep_editor(episode_id);
    Publishing.load_editor_options();

    reveal_timeout_ref.current = setTimeout(() => {
      if (!is_mounted_ref.current) {
        return;
      }

      set_editor_is_visible(true);
    }, EDITOR_REVEAL_DELAY_MS);

    return () => {
      is_mounted_ref.current = false;

      if (reveal_timeout_ref.current) {
        clearTimeout(reveal_timeout_ref.current);
      }

      Publishing.reset();
    };
  }, [episode_id]);

  React.useEffect(() => {
    try_focus_editor();
  }, [editor_is_visible]);

  React.useEffect(() => {
    const unsubscribe = navigation.addListener('blur', () => {
      pause_playback_ref.current();
    });

    return unsubscribe;
  }, [navigation]);

  async function handle_post() {
    if (!episode || Publishing.is_publishing) {
      return;
    }

    const post_url = await Publishing.publish_episode(episode_id);

    if (post_url === null) {
      Alert.alert('Publish failed', Publishing.error_message || 'Please try again.');
      return;
    }

    Alert.alert('Published', 'Your episode is on its way to Micro.blog.', [
      {
        onPress: () => navigation.goBack(),
        text: 'OK',
      },
    ]);
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

  post_handler_ref.current = handle_post;

  React.useLayoutEffect(() => {
    const post_label = Publishing.post_button_label();

    if (Platform.OS === 'ios') {
      navigation.setOptions({
        headerRight: undefined,
        title: 'New Post',
        unstable_headerRightItems: () =>
          build_ios_publish_header_items({
            is_publishing: Publishing.is_publishing,
            on_post: () => post_handler_ref.current?.(),
            post_label,
          }),
      });
      return;
    }

    navigation.setOptions({
      title: 'New Post',
      unstable_headerRightItems: undefined,
      ...header_right_element(() => (
        <HeaderPillButton
          accessibilityLabel="Post episode to Micro.blog"
          disabled={Publishing.is_publishing}
          label={Publishing.is_publishing ? 'Posting…' : post_label}
          onPress={() => post_handler_ref.current?.()}
          theme={theme}
        />
      )),
    });
  }, [navigation, theme, Publishing.is_publishing, Publishing.post_status]);

  if (!episode) {
    return (
      <View style={[styles.screen, styles.missingScreen, { backgroundColor: theme.colors.canvas }]}>
        <Text style={[styles.missingText, { color: theme.colors.ink_soft }]}>
          This episode is no longer available.
        </Text>
      </View>
    );
  }

  const status_label = Publishing.status_label();

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
            accessibilityLabel="Episode title"
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
          bottomOverlayHeight={180}
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
              paddingBottom: 180,
            },
          ]}
          theme={theme}
          value={Publishing.post_content}
        />

        {Publishing.is_publishing ? (
          <View style={styles.statusRow}>
            <ActivityIndicator color={theme.colors.accent} />
            <Text style={[styles.statusLabel, { color: theme.colors.ink_soft }]}>
              {status_label}
            </Text>
          </View>
        ) : null}
      </EditorKeyboardAvoidingView>

      <KeyboardStickyView>
        <View style={styles.stickyArea}>
          <EpisodeAttachmentToolbar
            current_time={playback.current_time}
            duration_seconds={playback.total_duration || episode.duration_seconds}
            episode_title={episode.title}
            is_playing={playback.playing}
            on_seek={handle_seek}
            on_toggle_playback={handle_toggle_playback}
            theme={theme}
            waveform={episode.waveform}
          />
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
  statusLabel: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  statusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
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

export default observer(PublishScreen);