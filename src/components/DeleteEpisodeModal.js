import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { with_color_opacity } from '../theme/wavelengthTheme';

const DESTRUCTIVE_COLOR = '#ef4444';

function confirm_delete({ message, on_confirm, title }) {
  Alert.alert(title, message, [
    { style: 'cancel', text: 'Cancel' },
    { onPress: on_confirm, style: 'destructive', text: 'Delete' },
  ]);
}

function DeleteOptionButton({
  detail = '',
  disabled = false,
  is_busy = false,
  is_destructive = false,
  label = '',
  onPress,
  theme,
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || is_busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.optionButton,
        {
          backgroundColor: is_destructive
            ? with_color_opacity(DESTRUCTIVE_COLOR, theme.is_dark ? 0.14 : 0.08)
            : theme.colors.glass,
          borderColor: is_destructive
            ? with_color_opacity(DESTRUCTIVE_COLOR, theme.is_dark ? 0.42 : 0.28)
            : theme.colors.line,
          opacity: disabled || is_busy ? 0.5 : 1,
        },
        pressed && !disabled && !is_busy ? styles.pressed : null,
      ]}
    >
      <View style={styles.optionCopy}>
        <Text
          style={[
            styles.optionLabel,
            { color: is_destructive ? DESTRUCTIVE_COLOR : theme.colors.ink },
          ]}
        >
          {label}
        </Text>
        {detail.length > 0 ? (
          <Text style={[styles.optionDetail, { color: theme.colors.ink_soft }]}>
            {detail}
          </Text>
        ) : null}
      </View>
      {is_busy ? (
        <ActivityIndicator
          color={is_destructive ? DESTRUCTIVE_COLOR : theme.colors.accent}
          size="small"
        />
      ) : null}
    </Pressable>
  );
}

function DeleteEpisodeModal({
  episode_title = '',
  has_published_post = false,
  is_busy = false,
  on_cancel,
  on_delete_device_and_post,
  on_delete_device_only,
  theme,
  visible = false,
}) {
  const trimmed_title = `${episode_title || ''}`.trim() || 'This episode';

  function request_delete_device_only() {
    if (is_busy) {
      return;
    }

    confirm_delete({
      message: has_published_post
        ? `"${trimmed_title}" will be removed from this device. Your Micro.blog post will stay published.`
        : `"${trimmed_title}" will be permanently removed from this device.`,
      on_confirm: on_delete_device_only,
      title: has_published_post ? 'Delete from device?' : 'Delete episode?',
    });
  }

  function request_delete_everywhere() {
    if (is_busy) {
      return;
    }

    confirm_delete({
      message: `"${trimmed_title}" and its Micro.blog post will be permanently removed.`,
      on_confirm: on_delete_device_and_post,
      title: 'Delete everywhere?',
    });
  }

  return (
    <Modal
      animationType="fade"
      onRequestClose={on_cancel}
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityLabel="Dismiss delete episode dialog"
          accessibilityRole="button"
          disabled={is_busy}
          onPress={on_cancel}
          style={styles.backdrop}
        />

        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.paper,
              borderColor: theme.colors.line,
            },
          ]}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.colors.ink }]}>
              Delete episode?
            </Text>
            <Text style={[styles.body, { color: theme.colors.ink_soft }]}>
              {has_published_post
                ? `"${trimmed_title}" will be removed from this device.`
                : `"${trimmed_title}" will be permanently removed from this device.`}
            </Text>
          </View>

          <View style={styles.actions}>
            {has_published_post ? (
              <>
                <DeleteOptionButton
                  detail="Keeps the post on Micro.blog"
                  is_busy={is_busy}
                  label="On device only"
                  onPress={request_delete_device_only}
                  theme={theme}
                />
                <DeleteOptionButton
                  detail="Also removes the post from your blog"
                  is_busy={is_busy}
                  is_destructive
                  label="Everywhere"
                  onPress={request_delete_everywhere}
                  theme={theme}
                />
              </>
            ) : (
              <DeleteOptionButton
                is_busy={is_busy}
                is_destructive
                label="Delete episode"
                onPress={request_delete_device_only}
                theme={theme}
              />
            )}

            <Pressable
              accessibilityRole="button"
              disabled={is_busy}
              onPress={on_cancel}
              style={({ pressed }) => [
                styles.cancelAction,
                pressed && !is_busy ? styles.pressed : null,
              ]}
            >
              <Text style={[styles.cancelLabel, { color: theme.colors.ink_soft }]}>
                Cancel
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 10,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  body: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  cancelAction: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
    paddingTop: 4,
  },
  cancelLabel: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  card: {
    borderCurve: 'continuous',
    borderRadius: 28,
    borderWidth: 1,
    gap: 16,
    maxWidth: 420,
    padding: 20,
    width: '100%',
  },
  header: {
    gap: 8,
  },
  optionButton: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  optionCopy: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
  },
  optionDetail: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 17,
    textAlign: 'center',
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 21,
    textAlign: 'center',
  },
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  pressed: {
    opacity: 0.72,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
  },
});

export default DeleteEpisodeModal;
