import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { observer } from 'mobx-react';

import Auth from '../stores/Auth';
import Episodes from '../stores/Episodes';
import HeaderPillButton from '../components/HeaderPillButton';
import Publishing from '../stores/Publishing';
import { header_right_element } from '../theme/wavelengthTheme';

function build_ios_publish_header_items({ is_publishing, on_post }) {
  return [
    {
      accessibilityLabel: 'Post episode to Micro.blog',
      disabled: is_publishing,
      label: is_publishing ? 'Posting…' : 'Post',
      onPress: on_post,
      type: 'button',
      variant: 'done',
    },
  ];
}

function PublishScreen({ navigation, route, theme }) {
  const episode_id = route.params?.episode_id;
  const episode = Episodes.get_episode(episode_id);
  const [title_draft, set_title_draft] = React.useState(episode?.title || '');
  const [notes_draft, set_notes_draft] = React.useState('');
  const post_handler_ref = React.useRef(null);

  React.useEffect(() => {
    Publishing.reset();

    return () => {
      Publishing.reset();
    };
  }, []);

  async function handle_post() {
    if (!episode || Publishing.is_publishing) {
      return;
    }

    const post_url = await Publishing.publish_episode(episode_id, {
      content: notes_draft.trim(),
      title: title_draft.trim(),
    });

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

  post_handler_ref.current = handle_post;

  React.useLayoutEffect(() => {
    if (Platform.OS === 'ios') {
      navigation.setOptions({
        headerRight: undefined,
        unstable_headerRightItems: () =>
          build_ios_publish_header_items({
            is_publishing: Publishing.is_publishing,
            on_post: () => post_handler_ref.current?.(),
          }),
      });
      return;
    }

    navigation.setOptions({
      unstable_headerRightItems: undefined,
      ...header_right_element(() => (
        <HeaderPillButton
          accessibilityLabel="Post episode to Micro.blog"
          disabled={Publishing.is_publishing}
          label={Publishing.is_publishing ? 'Posting…' : 'Post'}
          onPress={() => post_handler_ref.current?.()}
          theme={theme}
        />
      )),
    });
  }, [navigation, theme, Publishing.is_publishing]);

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
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={[styles.screen, { backgroundColor: theme.colors.canvas }]}
    >
      <View
        style={[
          styles.panel,
          {
            backgroundColor: theme.colors.paper,
            borderColor: theme.colors.line,
          },
        ]}
      >
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: theme.colors.ink_soft }]}>
            Title
          </Text>
          <TextInput
            accessibilityLabel="Episode title"
            editable={!Publishing.is_publishing}
            keyboardAppearance={theme.is_dark ? 'dark' : 'light'}
            onChangeText={set_title_draft}
            placeholder="Episode title"
            placeholderTextColor={theme.colors.ink_soft}
            selectionColor={theme.colors.accent}
            style={[styles.titleInput, { color: theme.colors.ink }]}
            value={title_draft}
          />
        </View>

        <View style={[styles.divider, { backgroundColor: theme.colors.line }]} />

        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: theme.colors.ink_soft }]}>
            Show notes
          </Text>
          <TextInput
            accessibilityLabel="Show notes"
            editable={!Publishing.is_publishing}
            keyboardAppearance={theme.is_dark ? 'dark' : 'light'}
            multiline
            onChangeText={set_notes_draft}
            placeholder="Add show notes (optional)"
            placeholderTextColor={theme.colors.ink_soft}
            selectionColor={theme.colors.accent}
            style={[styles.notesInput, { color: theme.colors.ink }]}
            textAlignVertical="top"
            value={notes_draft}
          />
        </View>
      </View>

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 16,
    paddingBottom: 36,
    paddingHorizontal: 20,
    paddingTop: 18,
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
    paddingHorizontal: 4,
  },
  destinationValue: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'right',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.6,
    lineHeight: 16,
    textTransform: 'uppercase',
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
  notesInput: {
    fontSize: 17,
    fontWeight: '500',
    lineHeight: 24,
    minHeight: 160,
    padding: 0,
  },
  panel: {
    borderCurve: 'continuous',
    borderRadius: 22,
    borderWidth: 1,
    gap: 16,
    padding: 20,
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
    paddingHorizontal: 4,
  },
  titleInput: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 25,
    padding: 0,
  },
});

export default observer(PublishScreen);
