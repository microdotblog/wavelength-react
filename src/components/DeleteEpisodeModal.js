import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

function DeleteOptionRow({
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
        styles.optionRow,
        {
          borderColor: theme.colors.line,
          opacity: disabled || is_busy ? 0.5 : 1,
        },
        pressed && !disabled && !is_busy ? styles.pressed : null,
      ]}
    >
      <View style={styles.optionCopy}>
        <Text
          style={[
            styles.optionLabel,
            { color: is_destructive ? '#ef4444' : theme.colors.ink },
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
        <ActivityIndicator color={is_destructive ? '#ef4444' : theme.colors.accent} size="small" />
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
                ? `"${trimmed_title}" will be removed from this device. You can also delete its published post on Micro.blog.`
                : `"${trimmed_title}" will be permanently removed from this device.`}
            </Text>
          </View>

          <View
            style={[
              styles.optionsPanel,
              {
                backgroundColor: theme.colors.paper_alt,
                borderColor: theme.colors.line,
              },
            ]}
          >
            {has_published_post ? (
              <>
                <DeleteOptionRow
                  detail="Keep the post on Micro.blog"
                  is_busy={is_busy}
                  label="Delete from device only"
                  onPress={on_delete_device_only}
                  theme={theme}
                />
                <View style={[styles.optionDivider, { backgroundColor: theme.colors.line }]} />
                <DeleteOptionRow
                  detail="Remove the post from your blog too"
                  is_busy={is_busy}
                  is_destructive
                  label="Delete from device and Micro.blog"
                  onPress={on_delete_device_and_post}
                  theme={theme}
                />
              </>
            ) : (
              <DeleteOptionRow
                is_busy={is_busy}
                is_destructive
                label="Delete from device"
                onPress={on_delete_device_only}
                theme={theme}
              />
            )}
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={is_busy}
            onPress={on_cancel}
            style={({ pressed }) => [
              styles.cancelButton,
              {
                backgroundColor: theme.colors.glass,
                borderColor: theme.colors.line,
                opacity: is_busy ? 0.5 : 1,
              },
              pressed && !is_busy ? styles.pressed : null,
            ]}
          >
            <Text style={[styles.cancelLabel, { color: theme.colors.ink }]}>
              Cancel
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  body: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  cancelButton: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  cancelLabel: {
    fontSize: 16,
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
  optionCopy: {
    flex: 1,
    gap: 3,
    paddingRight: 12,
  },
  optionDetail: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
  },
  optionDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 14,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 21,
  },
  optionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 58,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  optionsPanel: {
    borderCurve: 'continuous',
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
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
