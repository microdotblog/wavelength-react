import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

function CheckmarkRowCell({ is_selected = false, text = '', theme }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: theme.colors.ink }]}>{text}</Text>
      {is_selected ? (
        <Text style={[styles.checkmark, { color: theme.colors.accent }]}>✓</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  checkmark: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 18,
    marginLeft: 6,
  },
  label: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 24,
  },
});

export default CheckmarkRowCell;