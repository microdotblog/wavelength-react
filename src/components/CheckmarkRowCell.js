import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import PlatformSymbol from './PlatformSymbol';

function CheckmarkRowCell({ is_selected = false, text = '', theme }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: theme.colors.ink }]}>{text}</Text>
      {is_selected ? (
        <PlatformSymbol
          color={theme.colors.accent}
          name="checkmark"
          size={18}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
    paddingRight: 5,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 24,
  },
});

export default CheckmarkRowCell;