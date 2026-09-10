import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

export const POST_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'posts', label: 'Posts' },
  { id: 'podcasts', label: 'Podcasts' },
  { id: 'narrated', label: 'Narrated' },
];

function FilterPills({ on_select, selected_id = 'all', theme }) {
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      horizontal
      showsHorizontalScrollIndicator={false}
    >
      {POST_FILTERS.map(filter => {
        const is_selected = filter.id === selected_id;

        return (
          <Pressable
            accessibilityLabel={`Filter posts: ${filter.label}`}
            accessibilityRole="button"
            accessibilityState={{ selected: is_selected }}
            key={filter.id}
            onPress={() => on_select?.(filter.id)}
            style={({ pressed }) => [
              styles.pill,
              {
                backgroundColor: is_selected ? theme.colors.accent : theme.colors.glass,
                borderColor: is_selected ? theme.colors.accent : theme.colors.line,
              },
              pressed ? styles.pressed : null,
            ]}
          >
            <Text
              style={[
                styles.label,
                { color: is_selected ? theme.colors.button_text : theme.colors.ink },
              ]}
            >
              {filter.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
  },
  pill: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  pressed: {
    opacity: 0.72,
  },
});

export default FilterPills;
