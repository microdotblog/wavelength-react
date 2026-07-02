import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import PlatformSymbol from './PlatformSymbol';
import { resolve_discover_avatar_url } from '../lib/discover_posts';
import { with_color_opacity } from '../theme/wavelengthTheme';

const FEED_AVATAR_SIZE = 26;
const FEED_AVATAR_TRANSITION_MS = 180;

function DiscoverSourceAvatar({ avatar_url = '', source = '', theme }) {
  const resolved_avatar_url = resolve_discover_avatar_url(avatar_url);
  const [did_fail_to_load, set_did_fail_to_load] = React.useState(false);
  const initial = get_source_avatar_initial(source);
  const should_show_image = resolved_avatar_url && !did_fail_to_load;

  React.useEffect(() => {
    set_did_fail_to_load(false);
  }, [resolved_avatar_url]);

  return (
    <View
      style={[
        styles.sourceAvatarFrame,
        {
          backgroundColor: theme.colors.accent_soft,
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
          style={styles.sourceAvatarImage}
          transition={FEED_AVATAR_TRANSITION_MS}
        />
      ) : (
        <Text
          style={[
            styles.sourceAvatarInitial,
            { color: theme.colors.accent_strong },
          ]}
        >
          {initial}
        </Text>
      )}
    </View>
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

export default function DiscoverPostRow({
  accessibility_label = '',
  avatar_url = '',
  display_title = '',
  is_active = false,
  is_playable = false,
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
    <Pressable
      accessibilityLabel={accessibility_label || display_title}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => {
        return [
          styles.rowCard,
          {
            backgroundColor: background_color,
            borderColor: border_color,
            opacity: pressed ? 0.92 : 1,
          },
        ];
      }}
    >
      <View style={styles.rowContentWrap}>
        <DiscoverSourceAvatar
          avatar_url={avatar_url}
          source={source_label}
          theme={theme}
        />
        <View style={styles.rowContent}>
          <View style={styles.titleRow}>
            <Text
              numberOfLines={2}
              style={[
                styles.rowTitle,
                { color: theme.colors.ink },
              ]}
            >
              {display_title}
            </Text>
            {is_playable ? (
              <View
                style={[
                  styles.playableBadge,
                  {
                    backgroundColor: with_color_opacity(theme.colors.accent, theme.is_dark ? 0.2 : 0.12),
                  },
                ]}
              >
                <PlatformSymbol
                  color={theme.colors.accent}
                  name="waveform"
                  size={12}
                />
              </View>
            ) : null}
          </View>
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
  );
}

const styles = StyleSheet.create({
  rowCard: {
    borderCurve: 'continuous',
    borderRadius: 24,
    borderWidth: 1,
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
    borderRadius: FEED_AVATAR_SIZE / 2,
    flexShrink: 0,
    height: FEED_AVATAR_SIZE,
    justifyContent: 'center',
    overflow: 'hidden',
    width: FEED_AVATAR_SIZE,
  },
  sourceAvatarImage: {
    height: FEED_AVATAR_SIZE,
    width: FEED_AVATAR_SIZE,
  },
  sourceAvatarInitial: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 15,
  },
  playableBadge: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 12,
    flexShrink: 0,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  rowContent: {
    flex: 1,
    gap: 8,
  },
  rowTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
  },
  titleRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
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
