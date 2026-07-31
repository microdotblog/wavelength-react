import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity } from 'expo-widgets';

/**
 * Live Activity shown on the Lock Screen and Dynamic Island while recording.
 * Must stay pure: only @expo/ui, no hooks, and no module-scope values inside the body.
 */
function RecordingLiveActivityLayout(props, environment) {
  'widget';

  const accent_color = '#ff8800';
  const mic_color = environment.isLuminanceReduced ? '#FFFFFF' : '#FF3B30';
  const ink_color = environment.colorScheme === 'dark' ? '#FFFFFF' : '#24180d';
  const soft_color = environment.colorScheme === 'dark' ? '#D9C0A8' : '#756657';
  const status_label = props.statusLabel || 'Recording';
  const timer_start_ms = props.timerStartMs ?? Date.now();
  const timer_start = new Date(timer_start_ms);
  const timer_end = new Date(timer_start_ms + 24 * 60 * 60 * 1000);
  const pause_time = props.pauseTimeMs != null ? new Date(props.pauseTimeMs) : undefined;

  function render_timer(size) {
    return (
      <Text
        countsDown={false}
        modifiers={[
          font({ design: 'monospaced', size, weight: 'semibold' }),
          foregroundStyle(ink_color),
        ]}
        pauseTime={pause_time}
        timerInterval={{ lower: timer_start, upper: timer_end }}
      />
    );
  }

  return {
    banner: (
      <HStack alignment="center" modifiers={[padding({ all: 14 })]} spacing={12}>
        <Image color={mic_color} size={22} systemName="mic.fill" />
        <VStack alignment="leading" spacing={2}>
          <Text modifiers={[font({ size: 15, weight: 'bold' }), foregroundStyle(accent_color)]}>
            {status_label}
          </Text>
          <Text modifiers={[font({ size: 13, weight: 'medium' }), foregroundStyle(soft_color)]}>
            Wavelength
          </Text>
        </VStack>
        <Spacer />
        {render_timer(16)}
      </HStack>
    ),
    compactLeading: <Image color={mic_color} size={16} systemName="mic.fill" />,
    compactTrailing: render_timer(14),
    expandedBottom: (
      <VStack alignment="leading" modifiers={[padding({ bottom: 12, horizontal: 12 })]} spacing={4}>
        <Text modifiers={[font({ size: 15, weight: 'bold' }), foregroundStyle(accent_color)]}>
          {status_label}
        </Text>
        <Text modifiers={[font({ size: 13, weight: 'medium' }), foregroundStyle(soft_color)]}>
          Tap to return to Wavelength
        </Text>
      </VStack>
    ),
    expandedLeading: (
      <VStack modifiers={[padding({ all: 10 })]}>
        <Image color={mic_color} size={24} systemName="mic.fill" />
      </VStack>
    ),
    expandedTrailing: (
      <VStack modifiers={[padding({ all: 10 })]}>
        {render_timer(20)}
      </VStack>
    ),
    minimal: <Image color={mic_color} size={14} systemName="mic.fill" />,
  };
}

export default createLiveActivity('RecordingLiveActivity', RecordingLiveActivityLayout);
