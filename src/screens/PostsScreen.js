import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

function PostsScreen({ theme }) {
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      style={[styles.screen, { backgroundColor: theme.colors.canvas }]}
    >
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.paper,
            borderColor: theme.colors.line,
          },
        ]}
      >
        <Text style={[styles.title, { color: theme.colors.ink }]}>Posts</Text>
        <Text style={[styles.body, { color: theme.colors.ink_soft }]}>
          The microcasts you publish to Micro.blog will show up here.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 23,
  },
  card: {
    borderCurve: 'continuous',
    borderRadius: 22,
    borderWidth: 1,
    gap: 10,
    padding: 20,
  },
  content: {
    gap: 18,
    paddingBottom: 36,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  screen: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 27,
  },
});

export default PostsScreen;
