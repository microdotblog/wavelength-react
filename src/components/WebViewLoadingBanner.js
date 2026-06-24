import React from 'react';
import { Animated, Platform, Text, View } from 'react-native';

function WebViewLoadingBanner({
  loading_text = 'Loading microcasts...',
  progress = null,
  theme,
  top_offset,
  visible,
}) {
  const slide_anim = React.useRef(new Animated.Value(-100)).current;
  const progress_anim = React.useRef(new Animated.Value(0)).current;
  const sweep_anim = React.useRef(new Animated.Value(0)).current;
  const [was_visible, set_was_visible] = React.useState(false);
  const has_progress =
    progress !== undefined && progress !== null && typeof progress === 'number' && !Number.isNaN(progress);

  React.useEffect(() => {
    if (visible && !was_visible) {
      Animated.spring(slide_anim, {
        friction: 8,
        tension: 120,
        toValue: 0,
        useNativeDriver: true,
      }).start();
      set_was_visible(true);
    } else if (!visible && was_visible) {
      Animated.spring(slide_anim, {
        friction: 8,
        tension: 120,
        toValue: -100,
        useNativeDriver: true,
      }).start();
      set_was_visible(false);
    }
  }, [slide_anim, visible, was_visible]);

  React.useEffect(() => {
    if (has_progress && visible) {
      const progress_value = Math.max(0, Math.min(1, progress));
      Animated.timing(progress_anim, {
        duration: progress_value === 1 ? 400 : 200,
        toValue: progress_value,
        useNativeDriver: false,
      }).start();
      return undefined;
    }

    if (!has_progress && visible) {
      const loop_animation = Animated.loop(
        Animated.sequence([
          Animated.timing(sweep_anim, {
            duration: 1000,
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.timing(sweep_anim, {
            duration: 1000,
            toValue: 0,
            useNativeDriver: true,
          }),
        ]),
      );
      loop_animation.start();
      return () => loop_animation.stop();
    }

    if (has_progress) {
      progress_anim.setValue(0);
    } else {
      sweep_anim.setValue(0);
    }

    return undefined;
  }, [has_progress, progress, progress_anim, sweep_anim, visible]);

  if (!visible && !was_visible) {
    return null;
  }

  const top = top_offset ?? (Platform.OS === 'ios' ? 12 : 8);

  return (
    <Animated.View
      style={{
        backgroundColor: theme.colors.paper,
        borderColor: theme.colors.line,
        borderRadius: 12,
        borderWidth: 0.5,
        elevation: theme.is_dark ? 8 : 2,
        left: 12,
        padding: 12,
        position: 'absolute',
        right: 12,
        shadowColor: '#000',
        shadowOffset: {
          height: theme.is_dark ? 4 : 1,
          width: 0,
        },
        shadowOpacity: theme.is_dark ? 0.3 : 0.08,
        shadowRadius: theme.is_dark ? 8 : 3,
        top,
        transform: [{ translateY: slide_anim }],
        zIndex: 1000,
      }}
    >
      <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: theme.colors.ink, fontSize: 15, fontWeight: '500' }}>{loading_text}</Text>
        <View
          style={{
            backgroundColor: theme.colors.paper_alt,
            borderRadius: 2,
            height: 4,
            marginLeft: 12,
            overflow: 'hidden',
            width: 60,
          }}
        >
          {has_progress ? (
            <Animated.View
              style={{
                backgroundColor: theme.colors.accent,
                borderRadius: 2,
                height: '100%',
                width: progress_anim.interpolate({
                  extrapolate: 'clamp',
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              }}
            />
          ) : (
            <Animated.View
              style={{
                backgroundColor: theme.colors.accent,
                borderRadius: 2,
                height: '100%',
                transform: [
                  {
                    translateX: sweep_anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 36],
                    }),
                  },
                ],
                width: '40%',
              }}
            />
          )}
        </View>
      </View>
    </Animated.View>
  );
}

export default WebViewLoadingBanner;
