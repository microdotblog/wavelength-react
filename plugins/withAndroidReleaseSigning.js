const { withAppBuildGradle } = require('expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

const SIGNING_CONFIG = `    signingConfigs {
        release {
            storeFile file("release.keystore")
            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias System.getenv("ANDROID_KEY_ALIAS")
            keyPassword System.getenv("ANDROID_KEY_PASSWORD")
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }`;

function withAndroidReleaseSigning(config) {
  return withAppBuildGradle(config, config_with_gradle => {
    if (config_with_gradle.modResults.language !== 'groovy') {
      throw new Error('Android release signing requires a Groovy build.gradle file.');
    }

    const result = mergeContents({
      anchor: /packagingOptions\s*\{/,
      comment: '//',
      newSrc: SIGNING_CONFIG,
      offset: 0,
      src: config_with_gradle.modResults.contents,
      tag: 'wavelength-android-release-signing',
    });

    config_with_gradle.modResults.contents = result.contents;

    return config_with_gradle;
  });
}

module.exports = withAndroidReleaseSigning;
