import { types } from 'mobx-state-tree';

const WebView = types
  .model('WebView', {
    did_load_one_or_more_webviews: types.optional(types.boolean, false),
    web_view_epoch: types.optional(types.number, 0),
  })
  .actions(self => ({
    set_did_load_one_or_more_webviews() {
      self.did_load_one_or_more_webviews = true;
    },

    invalidate_webview_bootstrap() {
      self.did_load_one_or_more_webviews = false;
    },

    bump_web_view_epoch() {
      self.web_view_epoch += 1;
    },
  }))
  .create();

export default WebView;
