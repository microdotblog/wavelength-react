import React from 'react';
import { Image, Platform, StyleSheet, Text } from 'react-native';
import { SFSymbol } from 'react-native-sfsymbols';

import { TOOLBAR_SYMBOLS } from '../lib/toolbar_symbols';

function PlatformSymbol({
  color = '',
  multicolor = false,
  name = '',
  size = 18,
  style = null,
}) {
  const symbol = TOOLBAR_SYMBOLS[name];

  if (!symbol) {
    return null;
  }

  const dimension = {
    height: size,
    width: size,
  };

  if (Platform.OS === 'ios') {
    return (
      <SFSymbol
        color={color}
        multicolor={multicolor || symbol.multicolor === true}
        name={symbol.ios}
        style={[dimension, style]}
      />
    );
  }

  if (symbol.android_image) {
    return (
      <Image
        source={symbol.android_image}
        style={[dimension, style, { tintColor: color }]}
      />
    );
  }

  if (symbol.android_icon) {
    const { MaterialIcons } = require('@expo/vector-icons');
    const icon_size = size + (symbol.android_size_adjustment || 0);

    return (
      <MaterialIcons
        color={color}
        name={symbol.android_icon}
        size={icon_size}
        style={[symbol.android_style, style]}
      />
    );
  }

  if (symbol.android_label) {
    return (
      <Text
        style={[
          styles.androidLabel,
          {
            color,
            fontSize: Math.max(size - 2, 12),
            lineHeight: size,
            minWidth: size,
          },
          style,
        ]}
      >
        {symbol.android_label}
      </Text>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  androidLabel: {
    fontWeight: '700',
    textAlign: 'center',
  },
});

export default PlatformSymbol;