import React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { observer } from 'mobx-react';
import { SafeAreaView } from 'react-native-safe-area-context';

import Auth from '../stores/Auth';

const MICRO_BLOG_LOGO = require('../../assets/mb_logo.png');
const WAVELENGTH_ICON = require('../../assets/icon.png');

function WelcomeScreen({ theme }) {
  const is_signing_in = Auth.is_loading();
  const error_message = Auth.error_message;
  const [is_token_modal_visible, set_is_token_modal_visible] = React.useState(false);
  const [token_value, set_token_value] = React.useState('');

  function open_token_modal() {
    Auth.clear_error();
    set_is_token_modal_visible(true);
  }

  function close_token_modal() {
    if (is_signing_in) {
      return;
    }

    Auth.clear_error();
    set_is_token_modal_visible(false);
    set_token_value('');
  }

  function handle_token_value_change(value = '') {
    set_token_value(value);

    if (error_message) {
      Auth.clear_error();
    }
  }

  async function handle_token_submit() {
    const did_sign_in = await Auth.sign_in_with_token(token_value);

    if (did_sign_in) {
      set_is_token_modal_visible(false);
      set_token_value('');
    }
  }

  const footer_error_message = is_token_modal_visible ? null : error_message;
  const modal_error_message = is_token_modal_visible ? error_message : null;

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.canvas }]}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <Image source={WAVELENGTH_ICON} style={styles.appIcon} />
            <View style={styles.heroCopy}>
              <Text style={[styles.kicker, { color: theme.colors.accent_strong }]}>
                Wavelength
              </Text>
              <Text style={[styles.title, { color: theme.colors.ink }]}>
                Record, edit, and publish microcasts.
              </Text>
              <Text style={[styles.body, { color: theme.colors.ink_soft }]}>
                Sign in with Micro.blog to get started.
              </Text>
            </View>
          </View>

          <View style={styles.footer}>
            {footer_error_message ? (
              <Text
                selectable
                style={[styles.errorMessage, { color: theme.colors.accent_strong }]}
              >
                {footer_error_message}
              </Text>
            ) : null}

            <PrimaryButton
              disabled={is_signing_in}
              label={is_signing_in ? 'Connecting to Micro.blog...' : 'Sign in with Micro.blog'}
              leadingIconSource={MICRO_BLOG_LOGO}
              onLongPress={open_token_modal}
              onPress={Auth.sign_in_with_micro_blog}
              theme={theme}
            />

            <Pressable
              accessibilityRole="button"
              disabled={is_signing_in}
              onPress={open_token_modal}
              style={({ pressed }) => [
                styles.tokenLink,
                pressed && !is_signing_in ? styles.pressed : null,
              ]}
            >
              <Text style={[styles.tokenLinkText, { color: theme.colors.ink_soft }]}>
                Use an app token
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>

      <TokenSignInModal
        error_message={modal_error_message}
        is_signing_in={is_signing_in}
        onCancel={close_token_modal}
        onChangeTokenValue={handle_token_value_change}
        onSubmit={handle_token_submit}
        theme={theme}
        token_value={token_value}
        visible={is_token_modal_visible}
      />
    </View>
  );
}

function PrimaryButton({
  disabled = false,
  label,
  leadingIconSource = null,
  onLongPress,
  onPress,
  theme,
}) {
  const should_show_leading_icon = leadingIconSource != null;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onLongPress={onLongPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        {
          backgroundColor: disabled ? theme.colors.paper_alt : theme.colors.accent,
          boxShadow: disabled
            ? 'none'
            : theme.is_dark
              ? '0 10px 18px rgba(0, 0, 0, 0.28)'
              : '0 10px 18px rgba(95, 53, 0, 0.18)',
        },
        pressed && !disabled ? styles.primaryButtonPressed : null,
      ]}
    >
      {should_show_leading_icon ? (
        <View
          style={[
            styles.primaryButtonIcon,
            { backgroundColor: theme.colors.button_icon_background },
          ]}
        >
          {disabled ? (
            <ActivityIndicator color={theme.colors.accent_strong} size="small" />
          ) : (
            <Image source={leadingIconSource} style={styles.primaryButtonLogo} />
          )}
        </View>
      ) : null}
      <Text
        style={[
          styles.primaryButtonLabel,
          { color: disabled ? theme.colors.ink_soft : theme.colors.button_text },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function TokenSignInModal({
  error_message = null,
  is_signing_in = false,
  onCancel,
  onChangeTokenValue,
  onSubmit,
  theme,
  token_value = '',
  visible = false,
}) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onCancel}
      transparent
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalRoot}
      >
        <Pressable
          disabled={is_signing_in}
          onPress={onCancel}
          style={styles.modalBackdrop}
        />

        <View
          style={[
            styles.modalCard,
            {
              backgroundColor: theme.colors.paper,
              borderColor: theme.colors.line,
              boxShadow: theme.is_dark
                ? '0 16px 28px rgba(0, 0, 0, 0.42)'
                : '0 16px 28px rgba(95, 53, 0, 0.18)',
            },
          ]}
        >
          <Text style={[styles.modalTitle, { color: theme.colors.ink }]}>
            Sign in with a token
          </Text>
          <Text style={[styles.modalBody, { color: theme.colors.ink_soft }]}>
            Paste a Micro.blog app token from your account page.
          </Text>

          <View
            style={[
              styles.modalInputWrap,
              {
                backgroundColor: theme.colors.canvas,
                borderColor: theme.colors.line,
              },
            ]}
          >
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus={visible}
              onChangeText={onChangeTokenValue}
              onSubmitEditing={onSubmit}
              keyboardAppearance={theme.is_dark ? 'dark' : 'light'}
              placeholder="Micro.blog token"
              placeholderTextColor={theme.colors.ink_soft}
              returnKeyType="done"
              selectionColor={theme.colors.accent}
              style={[styles.modalInput, { color: theme.colors.ink }]}
              value={token_value}
            />
          </View>

          {error_message ? (
            <Text
              selectable
              style={[styles.modalError, { color: theme.colors.accent_strong }]}
            >
              {error_message}
            </Text>
          ) : null}

          <View style={styles.modalActions}>
            <PrimaryButton
              disabled={is_signing_in}
              label={is_signing_in ? 'Checking token...' : 'Sign in with token'}
              onPress={onSubmit}
              theme={theme}
            />
            <Pressable
              accessibilityRole="button"
              disabled={is_signing_in}
              onPress={onCancel}
              style={({ pressed }) => [
                styles.modalCancelAction,
                pressed && !is_signing_in ? styles.pressed : null,
              ]}
            >
              <Text style={[styles.modalCancelText, { color: theme.colors.ink_soft }]}>
                Cancel
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  appIcon: {
    borderRadius: 31,
    height: 76,
    width: 76,
  },
  body: {
    fontSize: 18,
    lineHeight: 27,
    maxWidth: 340,
  },
  content: {
    flexGrow: 1,
    gap: 36,
    justifyContent: 'space-between',
    paddingBottom: 28,
    paddingHorizontal: 24,
    paddingTop: 36,
  },
  errorMessage: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  footer: {
    gap: 14,
  },
  hero: {
    gap: 24,
    paddingTop: 8,
  },
  heroCopy: {
    gap: 14,
  },
  kicker: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 21,
  },
  modalActions: {
    gap: 10,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(18, 13, 7, 0.42)',
  },
  modalBody: {
    fontSize: 16,
    lineHeight: 23,
  },
  modalCancelAction: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '700',
  },
  modalCard: {
    borderCurve: 'continuous',
    borderRadius: 26,
    borderWidth: 1,
    gap: 16,
    padding: 20,
  },
  modalError: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  modalInput: {
    fontSize: 16,
    height: 50,
    lineHeight: 22,
    paddingVertical: 0,
  },
  modalInputWrap: {
    borderCurve: 'continuous',
    borderRadius: 17,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 31,
  },
  pressed: {
    opacity: 0.72,
  },
  primaryButton: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 22,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    minHeight: 58,
    paddingHorizontal: 16,
  },
  primaryButtonIcon: {
    alignItems: 'center',
    borderRadius: 15,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  primaryButtonLabel: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
  },
  primaryButtonLogo: {
    height: 20,
    width: 20,
  },
  primaryButtonPressed: {
    transform: [{ scale: 0.99 }],
  },
  safeArea: {
    flex: 1,
  },
  screen: {
    flex: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 38,
    maxWidth: 360,
  },
  tokenLink: {
    alignItems: 'center',
    minHeight: 34,
    justifyContent: 'center',
  },
  tokenLinkText: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
});

export default observer(WelcomeScreen);
