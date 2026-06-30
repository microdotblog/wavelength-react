import React from 'react';
import { StyleSheet, View } from 'react-native';
import { observer } from 'mobx-react';

import HybridWebView from '../components/HybridWebView';
import Auth from '../stores/Auth';
import { hybrid_web_view_background_color } from '../lib/webview';

export const DISCOVER_PODCASTS_ENDPOINT = 'hybrid/discover/podcasts';

function DiscoverScreen({ theme }) {
  const can_show_web_view = Auth.is_signed_in();

  return (
    <View style={[styles.screen, { backgroundColor: hybrid_web_view_background_color(theme) }]}>
      {can_show_web_view ? (
        <HybridWebView
          endpoint={DISCOVER_PODCASTS_ENDPOINT}
          loading_text="Loading microcasts..."
          show_actions={false}
          theme={theme}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
});

export default observer(DiscoverScreen);
