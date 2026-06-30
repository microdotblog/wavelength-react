const {
  build_webview_endpoint,
  build_webview_source_uri,
  resolve_webview_navigation,
  resolve_webview_tap_url,
} = require('../webview');

describe('build_webview_endpoint', () => {
  test('includes show_actions by default', () => {
    expect(build_webview_endpoint({
      endpoint: 'hybrid/posts',
      theme: 'light',
    })).toBe('hybrid/posts?theme=light&show_actions=true&fontsize=17');
  });

  test('omits show_actions when disabled', () => {
    expect(build_webview_endpoint({
      endpoint: 'hybrid/discover/podcasts',
      show_actions: false,
      theme: 'dark',
    })).toBe('hybrid/discover/podcasts?theme=dark&fontsize=17');
  });
});

describe('build_webview_source_uri', () => {
  test('omits show_actions from sign-in when disabled', () => {
    expect(build_webview_source_uri({
      endpoint: 'hybrid/discover/podcasts',
      show_actions: false,
      theme: 'light',
      token: 'abc123',
      web_url: 'https://micro.blog',
    })).toBe(
      'https://micro.blog/hybrid/signin?token=abc123&redirect_to=hybrid%2Fdiscover%2Fpodcasts%3Ftheme%3Dlight%26fontsize%3D17&theme=light',
    );
  });
});

describe('resolve_webview_tap_url', () => {
  test('maps microblog post taps to micro.blog post URLs', () => {
    expect(resolve_webview_tap_url('microblog://open/12345')).toBe('https://micro.blog/12345');
  });

  test('maps reply taps to the post URL', () => {
    expect(resolve_webview_tap_url('microblog://reply/67890')).toBe('https://micro.blog/67890');
  });

  test('maps profile taps to micro.blog profile URLs', () => {
    expect(resolve_webview_tap_url('microblog://user/manton')).toBe('https://micro.blog/manton');
  });

  test('decodes photo and video tap payloads', () => {
    const photo_url = 'https://cdn.micro.blog/photos/1/large.jpg';

    expect(resolve_webview_tap_url(`microblog://photo/${encodeURI(photo_url)}`)).toBe(photo_url);
    expect(resolve_webview_tap_url(`microblog://video/${encodeURI(photo_url)}`)).toBe(photo_url);
  });
});

describe('resolve_webview_navigation', () => {
  const endpoint = 'hybrid/discover/podcasts';

  test('allows sign-in and endpoint URLs to load in the webview', () => {
    expect(resolve_webview_navigation({
      endpoint,
      url: 'https://micro.blog/hybrid/signin?token=abc',
    })).toEqual({ action: 'allow' });

    expect(resolve_webview_navigation({
      endpoint,
      url: 'https://micro.blog/hybrid/discover/podcasts?theme=light&fontsize=17',
    })).toEqual({ action: 'allow' });
  });

  test('opens tapped posts in the browser instead of navigating the webview', () => {
    expect(resolve_webview_navigation({
      endpoint,
      url: 'microblog://open/12345',
    })).toEqual({
      action: 'block',
      open_url: 'https://micro.blog/12345',
    });
  });

  test('opens other links in the browser', () => {
    expect(resolve_webview_navigation({
      endpoint,
      url: 'https://example.com/article',
    })).toEqual({
      action: 'block',
      open_url: 'https://example.com/article',
    });
  });
});
