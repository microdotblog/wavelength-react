import React from 'react';
import { observer } from 'mobx-react';
import { Platform, RefreshControl, Text, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import WebView from 'react-native-webview';

import {
  build_webview_source_uri,
  get_base_webview_path,
  is_signin_webview_path,
  is_webview_endpoint_url,
  normalise_theme,
  should_attempt_webview_recovery,
} from '../lib/webview';
import { tab_bar_bottom_inset } from '../lib/webview_ui';
import Tokens from '../stores/Tokens';
import WebViewStore from '../stores/WebView';
import WebViewLoadingBanner from './WebViewLoadingBanner';

const MICRO_BLOG_WEB_URL = 'https://micro.blog';

function WebViewErrorView({ error_name, theme }) {
  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: theme.colors.canvas,
        flex: 1,
        height: '100%',
        justifyContent: 'center',
        position: 'absolute',
        width: '100%',
      }}
    >
      <Text style={{ color: theme.colors.ink, fontSize: 17, marginTop: 15 }}>Error loading content.</Text>
      <Text style={{ color: theme.colors.ink, fontWeight: '700', marginTop: 15 }}>{error_name}</Text>
      <Text style={{ color: theme.colors.ink, marginTop: 15 }}>Please pull to refresh to try again...</Text>
    </View>
  );
}

function HybridWebView({ endpoint, loading_text = 'Loading microcasts...', theme }) {
  const insets = useSafeAreaInsets();
  const web_view_ref = React.useRef(null);
  const has_set_did_load_ref = React.useRef(false);
  const has_attempted_recovery_ref = React.useRef(false);
  const [state, set_state] = React.useState({
    is_initial_load: true,
    is_loading: true,
    is_pull_to_refresh_enabled: true,
    loading_progress: 0,
    opacity: 0,
  });

  const theme_name = normalise_theme(theme.is_dark ? 'dark' : 'light');
  const web_view_key =
    Platform.OS === 'android' ? `${endpoint}:${WebViewStore.web_view_epoch}` : endpoint;
  const source_uri = build_webview_source_uri({
    did_load_one_or_more_webviews: WebViewStore.did_load_one_or_more_webviews,
    endpoint,
    theme: theme_name,
    token: Tokens.get_user_token(),
    web_url: MICRO_BLOG_WEB_URL,
  });
  const should_inject_web_view_padding = Platform.OS === 'ios' || Platform.OS === 'android';
  const web_view_bottom_padding = tab_bar_bottom_inset(insets.bottom);
  const web_view_css_properties_javascript = `
    (() => {
      const bottom_padding = '${web_view_bottom_padding}px'
      const apply_bottom_padding = () => {
        document.documentElement.style.setProperty('--microblog-webview-bottom-padding', bottom_padding)

        if (document.body) {
          document.body.style.setProperty('padding-bottom', 'var(--microblog-webview-bottom-padding)')
        }
      }

      apply_bottom_padding()

      if (!document.body) {
        document.addEventListener('DOMContentLoaded', apply_bottom_padding, { once: true })
      }
    })()
    true
  `;
  const web_view_injected_javascript =
    Platform.OS === 'ios'
      ? `
    const meta = document.createElement('meta')
    meta.setAttribute('content', 'width=width, initial-scale=1')
    meta.setAttribute('name', 'viewport')
    document.getElementsByTagName('head')[0].appendChild(meta)
    ${web_view_css_properties_javascript}
  `
      : should_inject_web_view_padding
        ? web_view_css_properties_javascript
        : null;

  React.useEffect(() => {
    has_attempted_recovery_ref.current = false;
  }, [endpoint]);

  React.useEffect(() => {
    if (should_inject_web_view_padding) {
      web_view_ref.current?.injectJavaScript(web_view_css_properties_javascript);
    }
  }, [should_inject_web_view_padding, web_view_css_properties_javascript]);

  const on_refresh = () => {
    set_state(prev_state => {
      if (!prev_state.is_initial_load) {
        return { ...prev_state, is_loading: true, opacity: 1 };
      }

      return prev_state;
    });
    web_view_ref.current?.reload();
  };

  const trigger_android_webview_recovery = (url = '') => {
    if (Platform.OS !== 'android') {
      return false;
    }

    if (
      !should_attempt_webview_recovery({
        did_load_one_or_more_webviews: WebViewStore.did_load_one_or_more_webviews,
        has_attempted_recovery: has_attempted_recovery_ref.current,
        url,
      })
    ) {
      return false;
    }

    has_set_did_load_ref.current = false;
    has_attempted_recovery_ref.current = true;
    WebViewStore.invalidate_webview_bootstrap();
    WebViewStore.bump_web_view_epoch();
    set_state(prev_state => ({
      ...prev_state,
      is_loading: true,
      loading_progress: 0,
    }));

    return true;
  };

  const open_external_url = async url => {
    try {
      await WebBrowser.openBrowserAsync(url, {
        controlsColor: theme.colors.accent,
        dismissButtonStyle: 'close',
      });
    } catch (error) {
      // ponytail: browser open failures are rare; user can retry the link.
    }
  };

  const on_should_start_load_with_request = event => {
    const url = event.url;
    const url_base_path = get_base_webview_path(url);
    const endpoint_base_path = get_base_webview_path(endpoint);

    if (url_base_path === 'hybrid/signin') {
      return true;
    }

    if (url_base_path === endpoint_base_path) {
      return true;
    }

    open_external_url(url);
    return false;
  };

  return (
    <>
      <WebViewLoadingBanner
        loading_text={loading_text}
        progress={state.loading_progress}
        theme={theme}
        visible={state.is_loading}
      />
      <ScrollView
        contentContainerStyle={{ flex: 1 }}
        overScrollMode={Platform.OS === 'ios' ? 'auto' : 'always'}
        refreshControl={
          <RefreshControl
            enabled={state.is_pull_to_refresh_enabled}
            onRefresh={on_refresh}
            refreshing={false}
          />
        }
        style={{
          backgroundColor: theme.colors.canvas,
          flex: 1,
          height: '100%',
          width: '100%',
        }}
      >
        <WebView
          key={web_view_key}
          ref={web_view_ref}
          containerStyle={{ flex: 1 }}
          decelerationRate={0.998}
          injectedJavaScript={web_view_injected_javascript}
          injectedJavaScriptBeforeContentLoaded={
            should_inject_web_view_padding ? web_view_css_properties_javascript : null
          }
          nestedScrollEnabled
          onContentProcessDidTerminate={() => web_view_ref.current?.reload()}
          onError={event => {
            trigger_android_webview_recovery(event?.nativeEvent?.url ?? source_uri);
          }}
          onHttpError={event => {
            trigger_android_webview_recovery(event?.nativeEvent?.url ?? source_uri);
          }}
          onLoadEnd={event => {
            const url = event?.nativeEvent?.url || '';
            const is_signin_url = is_signin_webview_path(url);
            const is_actual_endpoint = is_webview_endpoint_url({ endpoint, url });

            set_state(prev_state => {
              if (is_actual_endpoint && !is_signin_url) {
                if (!has_set_did_load_ref.current && !WebViewStore.did_load_one_or_more_webviews) {
                  WebViewStore.set_did_load_one_or_more_webviews();
                  has_set_did_load_ref.current = true;
                }

                has_attempted_recovery_ref.current = false;

                setTimeout(() => {
                  set_state(next_state => {
                    if (next_state.is_initial_load) {
                      if (!theme.is_dark) {
                        return {
                          ...next_state,
                          is_initial_load: false,
                          is_loading: false,
                          loading_progress: 1,
                          opacity: 1,
                        };
                      }

                      setTimeout(() => {
                        set_state(prev => ({
                          ...prev,
                          is_initial_load: false,
                          is_loading: false,
                          opacity: 1,
                        }));
                      }, 200);

                      return { ...next_state, is_loading: false, loading_progress: 1 };
                    }

                    web_view_ref.current?.injectJavaScript('window.scrollTo({ top: 0, behavior: "smooth" })');
                    return { ...next_state, is_loading: false, loading_progress: 1 };
                  });
                }, 300);

                return { ...prev_state, loading_progress: 1 };
              }

              return prev_state;
            });
          }}
          onLoadProgress={event => {
            if (event?.nativeEvent && typeof event.nativeEvent.progress === 'number') {
              const progress_value = Math.max(0, Math.min(1, event.nativeEvent.progress));
              set_state(prev_state => ({ ...prev_state, loading_progress: progress_value }));
            }
          }}
          onLoadStart={() => {
            set_state(prev_state => ({
              ...prev_state,
              is_loading: true,
              loading_progress: 0,
            }));
          }}
          onRenderProcessGone={event => {
            trigger_android_webview_recovery(event?.nativeEvent?.url ?? source_uri);
          }}
          onScroll={event => {
            const y = event.nativeEvent.contentOffset?.y;

            if (y != null) {
              set_state(prev_state => ({
                ...prev_state,
                is_pull_to_refresh_enabled: y <= 0.15,
              }));
            }
          }}
          onShouldStartLoadWithRequest={on_should_start_load_with_request}
          pullToRefreshEnabled={false}
          renderError={(name, code, description) => (
            <WebViewErrorView error_name={description} theme={theme} />
          )}
          renderLoading={() => <View style={{ backgroundColor: theme.colors.canvas, flex: 1 }} />}
          source={{ uri: source_uri }}
          startInLoadingState
          style={{
            backgroundColor: theme.colors.canvas,
            flex: 1,
            opacity: state.opacity,
          }}
        />
      </ScrollView>
    </>
  );
}

export default observer(HybridWebView);
