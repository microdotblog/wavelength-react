import React from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { observer } from 'mobx-react';

import CheckmarkRowCell from '../components/CheckmarkRowCell';
import Auth from '../stores/Auth';
import Publishing from '../stores/Publishing';

function OptionsSection({ children, label, theme }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: theme.colors.ink }]}>{label}</Text>
      <View
        style={[
          styles.sectionPanel,
          {
            backgroundColor: theme.colors.paper_alt,
            borderColor: theme.colors.line,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

function OptionRow({
  accessibility_label,
  accessibility_role = 'checkbox',
  children,
  is_selected = false,
  onPress,
}) {
  return (
    <Pressable
      accessibilityLabel={accessibility_label}
      accessibilityRole={accessibility_role}
      accessibilityState={{ selected: is_selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.optionRow,
        pressed ? styles.pressed : null,
      ]}
    >
      {children}
    </Pressable>
  );
}

function PublishOptionsScreen({ theme }) {
  const scroll_ref = React.useRef(null);
  const profile = Auth.current_profile();
  const destination_label =
    profile.default_site_name || profile.default_site || profile.url || 'your Micro.blog';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 125 : 0}
      style={[styles.screen, { backgroundColor: theme.colors.canvas }]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        ref={scroll_ref}
        showsVerticalScrollIndicator
      >
        <OptionsSection label="Posting to:" theme={theme}>
          <Text style={[styles.destinationValue, { color: theme.colors.ink }]}>
            {destination_label}
          </Text>
        </OptionsSection>

        <OptionsSection label="When sending this post:" theme={theme}>
          {!Publishing.is_editing_post ? (
            <>
              <OptionRow
                accessibility_label="Publish to your blog"
                accessibility_role="radio"
                is_selected={Publishing.post_status === 'published'}
                onPress={() => Publishing.handle_post_status_select('published')}
              >
                <CheckmarkRowCell
                  is_selected={Publishing.post_status === 'published'}
                  text="Publish to your blog"
                  theme={theme}
                />
              </OptionRow>
              <OptionRow
                accessibility_label="Save as a draft"
                accessibility_role="radio"
                is_selected={Publishing.post_status === 'draft'}
                onPress={() => Publishing.handle_post_status_select('draft')}
              >
                <CheckmarkRowCell
                  is_selected={Publishing.post_status === 'draft'}
                  text="Save as a draft"
                  theme={theme}
                />
              </OptionRow>
            </>
          ) : (
            <Text style={[styles.destinationValue, { color: theme.colors.ink_soft }]}>
              Updates apply to the existing post on Micro.blog.
            </Text>
          )}
        </OptionsSection>

        <OptionsSection label="Select categories for this post:" theme={theme}>
          {Publishing.available_categories.length > 0 ? (
            Publishing.available_categories.map(category => (
              <OptionRow
                accessibility_label={category}
                is_selected={Publishing.post_categories.includes(category)}
                key={category}
                onPress={() => Publishing.handle_post_category_select(category)}
              >
                <CheckmarkRowCell
                  is_selected={Publishing.post_categories.includes(category)}
                  text={category}
                  theme={theme}
                />
              </OptionRow>
            ))
          ) : (
            <Text style={[styles.emptyLabel, { color: theme.colors.ink_soft }]}>
              No categories to display
            </Text>
          )}

          <View style={styles.newCategoryRow}>
            <TextInput
              accessibilityLabel="Add new category"
              clearButtonMode="while-editing"
              keyboardAppearance={theme.is_dark ? 'dark' : 'light'}
              onChangeText={Publishing.set_new_category_text}
              onSubmitEditing={() => {
                if (Publishing.new_category_text.trim()) {
                  Publishing.handle_post_category_select(Publishing.new_category_text.trim());
                  Publishing.set_new_category_text('');
                }
              }}
              placeholder="Add new category..."
              placeholderTextColor={theme.colors.ink_soft}
              selectionColor={theme.colors.accent}
              style={[
                styles.newCategoryInput,
                {
                  backgroundColor: theme.colors.paper,
                  borderColor: theme.colors.line,
                  color: theme.colors.ink,
                },
              ]}
              value={Publishing.new_category_text}
            />
          </View>
        </OptionsSection>

        <OptionsSection label="View:" theme={theme}>
          <OptionRow
            accessibility_label="Show title field"
            is_selected={Publishing.show_title}
            onPress={() => Publishing.toggle_title()}
          >
            <CheckmarkRowCell
              is_selected={Publishing.show_title}
              text="Show title field"
              theme={theme}
            />
          </OptionRow>
        </OptionsSection>

        <OptionsSection label="Summary:" theme={theme}>
          <TextInput
            accessibilityLabel="Post summary"
            clearButtonMode="while-editing"
            keyboardAppearance={theme.is_dark ? 'dark' : 'light'}
            multiline
            onChangeText={Publishing.set_summary}
            placeholder="Summary"
            placeholderTextColor={theme.colors.ink_soft}
            selectionColor={theme.colors.accent}
            style={[
              styles.summaryInput,
              {
                backgroundColor: theme.colors.paper,
                borderColor: theme.colors.line,
                color: theme.colors.ink,
              },
            ]}
            value={Publishing.summary}
          />
        </OptionsSection>

        {Publishing.available_syndicates.length > 0 ? (
          <OptionsSection label="Cross-posting:" theme={theme}>
            {Publishing.available_syndicates.map(syndicate => (
              <OptionRow
                accessibility_label={syndicate.name}
                is_selected={Publishing.post_syndicates.includes(syndicate.uid)}
                key={syndicate.uid}
                onPress={() => Publishing.handle_post_syndicates_select(syndicate.uid)}
              >
                <CheckmarkRowCell
                  is_selected={Publishing.post_syndicates.includes(syndicate.uid)}
                  text={syndicate.name}
                  theme={theme}
                />
              </OptionRow>
            ))}
          </OptionsSection>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 24,
    padding: 15,
    paddingBottom: 50,
  },
  destinationValue: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
    padding: 8,
  },
  emptyLabel: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
    padding: 8,
  },
  newCategoryInput: {
    borderCurve: 'continuous',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  newCategoryRow: {
    marginTop: 8,
    paddingHorizontal: 8,
  },
  optionRow: {
    padding: 8,
  },
  pressed: {
    opacity: 0.72,
  },
  screen: {
    flex: 1,
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
  },
  sectionPanel: {
    borderCurve: 'continuous',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 2,
    padding: 8,
  },
  summaryInput: {
    borderCurve: 'continuous',
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    lineHeight: 22,
    minHeight: 88,
    paddingHorizontal: 12,
    paddingVertical: 8,
    textAlignVertical: 'top',
  },
});

export default observer(PublishOptionsScreen);
