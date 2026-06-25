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

import Auth from '../stores/Auth';
import Episodes from '../stores/Episodes';
import EditorKeyboardAvoidingView from '../components/EditorKeyboardAvoidingView';
import EpisodeAttachmentToolbar from '../components/EpisodeAttachmentToolbar';
import HeaderPillButton from '../components/HeaderPillButton';
import PublishPostToolbar from '../components/PublishPostToolbar';
import Publishing from '../stores/Publishing';
import { use_episode_playback } from '../hooks/use_episode_playback';
import { header_right_element } from '../theme/wavelengthTheme';

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
  const content_ref = React.useRef(null);
  const post_handler_ref = React.useRef(null);
  const pause_playback_ref = React.useRef(playback.pause);

  pause_playback_ref.current = playback.pause;

  React.useEffect(() => {
    Publishing.reset();
    Publishing.prep_editor(episode_id);
    Publishing.load_editor_options();

    return () => {
      Publishing.reset();
      pause_playback_ref.current();
    };
  }, [episode_id]);

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

  const profile = Auth.current_profile();
  const destination_label = profile.default_site || profile.url || 'your Micro.blog';
  const status_label = Publishing.status_label();

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.canvas }]}>
      <EditorKeyboardAvoidingView style={styles.editorArea}>
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
                borderBottomColor: theme.colors.line,
                color: theme.colors.ink,
              },
            ]}
            value={Publishing.post_title}
          />
        ) : null}

        <TextInput
          accessibilityLabel="Show notes"
          editable={!Publishing.is_publishing}
          keyboardAppearance={theme.is_dark ? 'dark' : 'light'}
          multiline
          onChangeText={Publishing.set_post_content}
          onSelectionChange={event => {
            Publishing.set_text_selection(event.nativeEvent.selection);
          }}
          placeholder="What's on your mind?"
          placeholderTextColor={theme.colors.ink_soft}
          ref={content_ref}
          scrollEnabled
          selectionColor={theme.colors.accent}
          style={[
            styles.contentInput,
            {
              color: theme.colors.ink,
              paddingBottom: 120,
            },
          ]}
          textAlignVertical="top"
          value={Publishing.post_content}
        />

        <View style={styles.destinationRow}>
          <Text style={[styles.destinationLabel, { color: theme.colors.ink_soft }]}>
            Posting to
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.destinationValue, { color: theme.colors.ink }]}
          >
            {destination_label}
          </Text>
        </View>

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
    fontWeight: '500',
    lineHeight: 26,
    minHeight: 300,
    padding: 13,
  },
  destinationLabel: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
  },
  destinationRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  destinationValue: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'right',
  },
  editorArea: {
    flex: 1,
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