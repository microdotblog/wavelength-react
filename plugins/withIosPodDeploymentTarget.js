const { withPodfile } = require('expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

const SNIPPET = `    min_ios = podfile_properties['ios.deploymentTarget'] || '16.4'
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        current = config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current.nil? || current.to_s.empty? || current.to_f < min_ios.to_f
          config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = min_ios
        end
      end
    end`;

function withIosPodDeploymentTarget(config) {
  return withPodfile(config, config_with_podfile => {
    const result = mergeContents({
      anchor: /:ccache_enabled => ccache_enabled\?\(podfile_properties\),/,
      comment: '#',
      newSrc: SNIPPET,
      offset: 2,
      src: config_with_podfile.modResults.contents,
      tag: 'wavelength-ios-min-deployment-target',
    });

    if (!result.didMerge) {
      throw new Error(
        'Cannot add iOS pod deployment target bump to Podfile because the react_native_post_install block was not found.'
      );
    }

    config_with_podfile.modResults.contents = result.contents;
    return config_with_podfile;
  });
}

module.exports = withIosPodDeploymentTarget;
