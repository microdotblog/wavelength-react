import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, frame, padding } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity } from 'expo-widgets';

/**
 * Live Activity shown on the Lock Screen and Dynamic Island while recording.
 * Must stay pure: only @expo/ui, no hooks, and no module-scope values inside the body.
 */
function RecordingLiveActivityLayout(props, environment) {
  'widget';

  const is_dark = environment.colorScheme === 'dark';
  const is_dimmed = !!environment.isLuminanceReduced;

  // Lock Screen banner follows the system color scheme.
  const accent_color = '#ff8800';
  const banner_ink = is_dark ? '#FFFFFF' : '#24180d';
  const banner_soft = is_dark ? '#D9C0A8' : '#756657';

  // Dynamic Island is always on a black capsule — never use light-mode ink there.
  const island_ink = is_dimmed ? '#B0B0B0' : '#FFFFFF';
  const island_soft = is_dimmed ? '#8A8A8A' : '#C8C8C8';
  const mic_color = is_dimmed ? '#FFFFFF' : '#FF3B30';

  const status_label = props.statusLabel || 'Recording';
  const timer_start_ms = props.timerStartMs ?? Date.now();
  const timer_start = new Date(timer_start_ms);
  // Match Live Activity's ~8h lifetime so the count-up doesn't freeze mid-recording.
  const timer_end = new Date(timer_start_ms + 8 * 60 * 60 * 1000);
  const pause_time = props.pauseTimeMs != null ? new Date(props.pauseTimeMs) : undefined;

  function render_timer(size, color, width) {
    return (
      <Text
        countsDown={false}
        modifiers={[
          font({ design: 'monospaced', size, weight: 'semibold' }),
          foregroundStyle(color),
          // ponytail: SwiftUI timer Text expands to fill available width in Dynamic Island;
          // fixed width keeps compact leading/trailing hugging the hardware island.
          frame({ width, alignment: 'trailing' }),
        ]}
        pauseTime={pause_time}
        timerInterval={{ lower: timer_start, upper: timer_end }}
      />
    );
  }

  return {
    banner: (
      <HStack alignment="center" modifiers={[padding({ all: 12 })]} spacing={10}>
        <Image color={mic_color} size={18} systemName="mic.fill" />
        <VStack alignment="leading" spacing={2}>
          <Text modifiers={[font({ size: 15, weight: 'bold' }), foregroundStyle(accent_color)]}>
            {status_label}
          </Text>
          <Text modifiers={[font({ size: 13, weight: 'medium' }), foregroundStyle(banner_soft)]}>
            Wavelength
          </Text>
        </VStack>
        <Spacer />
        {render_timer(15, banner_ink, 64)}
      </HStack>
    ),
    compactLeading: <Image color={mic_color} size={12} systemName="mic.fill" />,
    // Recording uses an 8h count-up window (H:MM:SS). Keep this tighter than the
    // unconstrained timer Text, but wide enough for the hours component.
    compactTrailing: render_timer(12, island_ink, 44),
    expandedBottom: (
      <VStack alignment="leading" modifiers={[padding({ bottom: 10, horizontal: 12 })]} spacing={2}>
        <Text modifiers={[font({ size: 14, weight: 'bold' }), foregroundStyle(accent_color)]}>
          {status_label}
        </Text>
        <Text modifiers={[font({ size: 12, weight: 'medium' }), foregroundStyle(island_soft)]}>
          Tap to return to Wavelength
        </Text>
      </VStack>
    ),
    expandedLeading: (
      <VStack modifiers={[padding({ leading: 12, vertical: 8 })]}>
        <Image color={mic_color} size={18} systemName="mic.fill" />
      </VStack>
    ),
    expandedTrailing: (
      <VStack modifiers={[padding({ trailing: 12, vertical: 8 })]}>
        {render_timer(16, island_ink, 64)}
      </VStack>
    ),
    minimal: <Image color={mic_color} size={12} systemName="mic.fill" />,
  };
}

export default createLiveActivity('RecordingLiveActivity', RecordingLiveActivityLayout);
