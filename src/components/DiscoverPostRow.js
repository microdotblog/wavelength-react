import React from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import PlatformSymbol from './PlatformSymbol';
import { resolve_discover_avatar_url } from '../lib/discover_posts';
import { with_color_opacity } from '../theme/wavelengthTheme';

const FEED_AVATAR_SIZE = 26;
const FEED_AVATAR_TRANSITION_MS = 180;
const ROW_PLAY_BUTTON_SIZE = 40;
const ROW_PLAY_ICON_SIZE = Platform.select({ android: 22, default: 16 });

function DiscoverSourceAvatar({
  avatar_url = '',
  size = FEED_AVATAR_SIZE,
  source = '',
  theme,
}) {
  const resolved_avatar_url = resolve_discover_avatar_url(avatar_url);
  const [did_fail_to_load, set_did_fail_to_load] = React.useState(false);
  const initial = get_source_avatar_initial(source);
  const should_show_image = resolved_avatar_url && !did_fail_to_load;
  const initial_font_size = Math.max(12, Math.round(size * 0.54));

  React.useEffect(() => {
    set_did_fail_to_load(false);
  }, [resolved_avatar_url]);

  return (
    <View
      style={[
        styles.sourceAvatarFrame,
        {
          backgroundColor: theme.colors.accent_soft,
          borderRadius: size / 2,
          height: size,
          width: size,
        },
      ]}
    >
      {should_show_image ? (
        <Image
          cachePolicy="memory-disk"
          contentFit="cover"
          onError={() => set_did_fail_to_load(true)}
          recyclingKey={resolved_avatar_url}
          source={{ uri: resolved_avatar_url }}
          style={{
            height: size,
            width: size,
          }}
          transition={FEED_AVATAR_TRANSITION_MS}
        />
      ) : (
        <Text
          style={[
            styles.sourceAvatarInitial,
            {
              color: theme.colors.accent_strong,
              fontSize: initial_font_size,
              lineHeight: initial_font_size + 1,
            },
          ]}
        >
          {initial}
        </Text>
      )}
    </View>
  );
}

function DiscoverRowPlayButton({
  display_title = '',
  is_buffering = false,
  is_playing = false,
  onPress,
  theme,
}) {
  if (is_buffering) {
    return (
      <View
        accessibilityLabel={`Buffering ${display_title}`}
        style={[
          styles.playButton,
          {
            backgroundColor: with_color_opacity(theme.colors.accent, theme.is_dark ? 0.18 : 0.12),
            borderColor: with_color_opacity(theme.colors.accent, theme.is_dark ? 0.5 : 0.35),
          },
        ]}
      >
        <ActivityIndicator color={theme.colors.accent} size="small" />
      </View>
    );
  }

  return (
    <Pressable
      accessibilityLabel={is_playing ? `Pause ${display_title}` : `Play ${display_title}`}
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.playButton,
        {
          backgroundColor: theme.colors.accent,
          borderColor: with_color_opacity(theme.colors.accent, theme.is_dark ? 0.5 : 0.35),
        },
        pressed ? styles.pressed : null,
      ]}
    >
      <PlatformSymbol
        color={theme.colors.button_text}
        name={is_playing ? 'pause' : 'play'}
        size={ROW_PLAY_ICON_SIZE}
      />
    </Pressable>
  );
}

function get_source_avatar_initial(source = '') {
  const trimmed_source = `${source || ''}`.trim();
  const initial = trimmed_source.charAt(0).toUpperCase();

  if (initial) {
    return initial;
  } else {
    return 'M';
  }
}

export { DiscoverSourceAvatar };

export default function DiscoverPostRow({
  accessibility_label = '',
  avatar_url = '',
  display_title = '',
  is_active = false,
  is_buffering = false,
  is_playable = false,
  is_playing = false,
  on_play_press,
  onPress,
  secondary_source_label = '',
  source_label = 'Micro.blog',
  summary = '',
  theme,
  timestamp = '',
}) {
  const border_color = is_active
    ? theme.colors.accent
    : theme.colors.line;
  const background_color = is_active
    ? with_color_opacity(theme.colors.accent, theme.is_dark ? 0.12 : 0.08)
    : theme.colors.paper;

  return (
    <View
      style={[
        styles.rowCard,
        {
          backgroundColor: background_color,
          borderColor: border_color,
        },
      ]}
    >
      <Pressable
        accessibilityLabel={accessibility_label || `Open ${display_title}`}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.rowBody,
          pressed ? styles.pressed : null,
        ]}
      >
        <View style={styles.rowContentWrap}>
          <DiscoverSourceAvatar
            avatar_url={avatar_url}
            source={source_label}
            theme={theme}
          />
          <View style={styles.rowContent}>
            <Text
              numberOfLines={2}
              style={[
                styles.rowTitle,
                { color: theme.colors.ink },
              ]}
            >
              {display_title}
            </Text>
            {summary ? (
              <Text
                numberOfLines={3}
                style={[
                  styles.rowSummary,
                  { color: theme.colors.ink_soft },
                ]}
              >
                {summary}
              </Text>
            ) : null}
            {secondary_source_label ? (
              <Text
                numberOfLines={1}
                style={[
                  styles.rowSourceLabel,
                  { color: theme.colors.ink_soft },
                ]}
              >
                {secondary_source_label}
              </Text>
            ) : null}
            {timestamp ? (
              <Text
                style={[
                  styles.timestamp,
                  { color: theme.colors.ink_soft },
                ]}
              >
                {timestamp}
              </Text>
            ) : null}
          </View>
        </View>
      </Pressable>

      {is_playable ? (
        <DiscoverRowPlayButton
          display_title={display_title}
          is_buffering={is_active && is_buffering}
          is_playing={is_active && is_playing}
          onPress={on_play_press}
          theme={theme}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  playButton: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: ROW_PLAY_BUTTON_SIZE / 2,
    borderWidth: 2,
    flexShrink: 0,
    height: ROW_PLAY_BUTTON_SIZE,
    justifyContent: 'center',
    width: ROW_PLAY_BUTTON_SIZE,
  },
  pressed: {
    opacity: 0.72,
  },
  rowBody: {
    flex: 1,
  },
  rowCard: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  rowContentWrap: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  sourceAvatarFrame: {
    alignItems: 'center',
    flexShrink: 0,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  sourceAvatarInitial: {
    fontWeight: '700',
  },
  rowContent: {
    flex: 1,
    gap: 8,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
  },
  rowSummary: {
    fontSize: 15,
    lineHeight: 22,
  },
  rowSourceLabel: {
    fontSize: 15,
    lineHeight: 20,
  },
  timestamp: {
    fontSize: 13,
    lineHeight: 18,
  },
});