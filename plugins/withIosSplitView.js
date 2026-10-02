const { withPodfile } = require('expo/config-plugins');

const PODFILE_ANCHOR = "require 'json'\n";
const SPLIT_VIEW_FLAG = "ENV['RNS_GAMMA_ENABLED'] = '1'";

function withIosSplitView(config) {
  return withPodfile(config, config_with_podfile => {
    const contents = config_with_podfile.modResults.contents;

    if (contents.includes(SPLIT_VIEW_FLAG)) {
      return config_with_podfile;
    }

    if (!contents.includes(PODFILE_ANCHOR)) {
      throw new Error('Cannot enable iPad split view because the Podfile header was not found.');
    }

    config_with_podfile.modResults.contents = contents.replace(
      PODFILE_ANCHOR,
      `${PODFILE_ANCHOR}${SPLIT_VIEW_FLAG}\n`
    );
    return config_with_podfile;
  });
}

module.exports = withIosSplitView;
