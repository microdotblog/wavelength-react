import React from 'react';
import { Image, Platform } from 'react-native';
import { SFSymbol } from 'react-native-sfsymbols';
import { SvgXml } from 'react-native-svg';

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

  if (symbol.android_svg) {
    return (
      <SvgXml
        color={color}
        style={[dimension, style]}
        xml={symbol.android_svg}
      />
    );
  }

  return null;
}

export default PlatformSymbol;