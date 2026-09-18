const { withAppDelegate, withInfoPlist, IOSConfig } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SCENE_DELEGATE = fs.readFileSync(
  path.join(__dirname, 'SceneDelegate.swift'),
  'utf8'
);

function withIosSceneLifecycle(config) {
  config = withInfoPlist(config, config_with_plist => {
    config_with_plist.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    };
    return config_with_plist;
  });

  config = withAppDelegate(config, config_with_delegate => {
    if (config_with_delegate.modResults.language !== 'swift') {
      throw new Error('iOS scene lifecycle requires a Swift AppDelegate.');
    }

    const contents = config_with_delegate.modResults.contents;
    if (!contents.includes('factory.startReactNative(')) {
      return config_with_delegate;
    }

    const next = contents.replace(
      `#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)`,
      'return super.application(application, didFinishLaunchingWithOptions: launchOptions)'
    );

    if (next === contents) {
      throw new Error(
        'Cannot adopt UIScene life cycle because AppDelegate.swift window setup was not found.'
      );
    }

    config_with_delegate.modResults.contents = next;
    return config_with_delegate;
  });

  return IOSConfig.XcodeProjectFile.withBuildSourceFile(config, {
    filePath: 'SceneDelegate.swift',
    overwrite: true,
    contents: SCENE_DELEGATE,
  });
}

module.exports = withIosSceneLifecycle;
