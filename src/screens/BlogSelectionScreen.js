import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { observer } from 'mobx-react';

import CheckmarkRowCell from '../components/CheckmarkRowCell';
import Auth from '../stores/Auth';

function BlogSelectionScreen({ navigation, theme }) {
  React.useEffect(() => {
    Auth.load_destinations();
  }, []);

  async function handle_select_destination(destination) {
    const did_select = await Auth.select_destination(destination);

    if (did_select) {
      navigation.goBack();
    }
  }

  function render_destination({ item }) {
    const is_selected = Auth.is_destination_selected(item.uid);

    return (
      <Pressable
        accessibilityLabel={`Publish to ${item.name}`}
        accessibilityRole="radio"
        accessibilityState={{ selected: is_selected }}
        onPress={() => handle_select_destination(item)}
        style={({ pressed }) => [
          styles.destinationRow,
          {
            backgroundColor: theme.colors.paper,
            borderColor: theme.colors.line,
          },
          pressed ? styles.pressed : null,
        ]}
      >
        <CheckmarkRowCell
          is_selected={is_selected}
          text={item.name}
          theme={theme}
        />
      </Pressable>
    );
  }

  function render_empty_state() {
    if (Auth.is_loading_destinations) {
      return (
        <View style={styles.centeredState}>
          <ActivityIndicator color={theme.colors.accent} size="large" />
        </View>
      );
    }

    if (Auth.destination_error_message) {
      return (
        <Pressable
          accessibilityRole="button"
          onPress={() => Auth.load_destinations()}
          style={({ pressed }) => [
            styles.messageCard,
            {
              backgroundColor: theme.colors.paper,
              borderColor: theme.colors.line,
            },
            pressed ? styles.pressed : null,
          ]}
        >
          <Text style={[styles.messageTitle, { color: theme.colors.ink }]}>
            Could not load blogs
          </Text>
          <Text style={[styles.messageBody, { color: theme.colors.ink_soft }]}>
            Tap to try again.
          </Text>
        </Pressable>
      );
    }

    return (
      <View
        style={[
          styles.messageCard,
          {
            backgroundColor: theme.colors.paper,
            borderColor: theme.colors.line,
          },
        ]}
      >
        <Text style={[styles.messageTitle, { color: theme.colors.ink }]}>
          No blogs available
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={[
        styles.content,
        Auth.destinations.length === 0 ? styles.emptyContent : null,
      ]}
      contentInsetAdjustmentBehavior="automatic"
      data={Auth.destinations.slice()}
      keyExtractor={item => item.uid}
      ListEmptyComponent={render_empty_state}
      renderItem={render_destination}
      style={[styles.screen, { backgroundColor: theme.colors.canvas }]}
    />
  );
}

const styles = StyleSheet.create({
  centeredState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    gap: 10,
    paddingBottom: 36,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  destinationRow: {
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  emptyContent: {
    flexGrow: 1,
  },
  messageBody: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 21,
  },
  messageCard: {
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
    padding: 18,
  },
  messageTitle: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 23,
  },
  pressed: {
    opacity: 0.72,
  },
  screen: {
    flex: 1,
  },
});

export default observer(BlogSelectionScreen);
