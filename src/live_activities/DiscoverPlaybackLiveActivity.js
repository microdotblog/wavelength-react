import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  cornerRadius,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  padding,
  resizable,
} from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity } from 'expo-widgets';

/**
 * Live Activity shown on the Lock Screen and Dynamic Island while Discover
 * playback is actively playing. Must stay pure: only @expo/ui, no hooks, and
 * no module-scope values inside the body.
 */
function DiscoverPlaybackLiveActivityLayout(props, environment) {
  'widget';

  const is_dark = environment.colorScheme === 'dark';
  const is_dimmed = !!environment.isLuminanceReduced;

  const accent_color = '#ff8800';
  const banner_ink = is_dark ? '#FFFFFF' : '#24180d';
  const banner_soft = is_dark ? '#D9C0A8' : '#756657';
  const island_ink = is_dimmed ? '#B0B0B0' : '#FFFFFF';
  const island_soft = is_dimmed ? '#8A8A8A' : '#C8C8C8';
  const play_color = is_dimmed ? '#FFFFFF' : accent_color;

  const title = props.title || 'Podcast';
  const artist_name = props.artistName || 'Discover';
  const artwork_uri = props.artworkUri || '';
  const starts_at = new Date(props.startsAtMs ?? Date.now());
  const ends_at = new Date(props.endsAtMs ?? Date.now());

  function render_artwork(size) {
    if (artwork_uri) {
      return (
        <Image
          modifiers={[
            resizable(),
            frame({ height: size, width: size }),
            cornerRadius(Math.round(size * 0.22)),
          ]}
          uiImage={artwork_uri}
        />
      );
    }

    return (
      <Image
        color={play_color}
        size={size > 16 ? 18 : 12}
        systemName="play.fill"
      />
    );
  }

  function render_remaining(size, color, width) {
    return (
      <Text
        countsDown
        modifiers={[
          font({ design: 'monospaced', size, weight: 'semibold' }),
          foregroundStyle(color),
          // ponytail: SwiftUI timer Text expands to fill available width in Dynamic Island;
          // fixed width keeps compact leading/trailing hugging the hardware island.
          frame({ width, alignment: 'trailing' }),
        ]}
        timerInterval={{ lower: starts_at, upper: ends_at }}
      />
    );
  }

  return {
    banner: (
      <HStack alignment="center" modifiers={[padding({ all: 12 })]} spacing={10}>
        {render_artwork(40)}
        <VStack alignment="leading" spacing={2}>
          <Text
            modifiers={[
              font({ size: 15, weight: 'bold' }),
              foregroundStyle(banner_ink),
              lineLimit(1),
            ]}
          >
            {title}
          </Text>
          <Text
            modifiers={[
              font({ size: 13, weight: 'medium' }),
              foregroundStyle(banner_soft),
              lineLimit(1),
            ]}
          >
            {artist_name}
          </Text>
        </VStack>
        <Spacer />
        {render_remaining(15, banner_ink, 64)}
      </HStack>
    ),
    compactLeading: render_artwork(20),
    compactTrailing: render_remaining(12, island_ink, 52),
    expandedBottom: (
      <VStack alignment="leading" modifiers={[padding({ bottom: 10, horizontal: 12 })]} spacing={2}>
        <Text
          modifiers={[
            font({ size: 14, weight: 'bold' }),
            foregroundStyle(island_ink),
            lineLimit(1),
          ]}
        >
          {title}
        </Text>
        <Text
          modifiers={[
            font({ size: 12, weight: 'medium' }),
            foregroundStyle(island_soft),
            lineLimit(1),
          ]}
        >
          {artist_name}
        </Text>
      </VStack>
    ),
    expandedLeading: (
      <VStack modifiers={[padding({ leading: 12, vertical: 8 })]}>
        {render_artwork(36)}
      </VStack>
    ),
    expandedTrailing: (
      <VStack modifiers={[padding({ trailing: 12, vertical: 8 })]}>
        {render_remaining(16, island_ink, 64)}
      </VStack>
    ),
    minimal: render_artwork(16),
  };
}

export default createLiveActivity('DiscoverPlaybackLiveActivity', DiscoverPlaybackLiveActivityLayout);
