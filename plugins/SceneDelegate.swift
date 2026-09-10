import ObjectiveC
import React
import UIKit

private let wavelengthRecordTabTitle = "Record" // Keep in sync with RECORD_TAB_LABEL.
private let wavelengthRecordTabSymbol = "mic.fill" // Keep in sync with ios_record_tab_options.

enum WavelengthTabBar {
  fileprivate static var isApplyingTabs = false
  private static var didInstall = false

  static func install() {
    guard !didInstall else {
      return
    }

    let original = #selector(UITabBarController.setViewControllers(_:animated:))
    let swizzled = #selector(UITabBarController.wavelength_setViewControllers(_:animated:))
    guard
      let originalMethod = class_getInstanceMethod(UITabBarController.self, original),
      let swizzledMethod = class_getInstanceMethod(UITabBarController.self, swizzled)
    else {
      return
    }

    method_exchangeImplementations(originalMethod, swizzledMethod)
    if #available(iOS 18.0, *) {
      wavelength_installShouldSelectTabHook()
    }
    didInstall = true
  }
}

@available(iOS 18.0, *)
private func wavelength_installShouldSelectTabHook() {
  guard let cls = NSClassFromString("RNSTabBarController") else {
    return
  }

  let selector = NSSelectorFromString("tabBarController:shouldSelectTab:")
  if class_respondsToSelector(cls, selector) {
    return
  }

  let handle: @convention(c) (
    UITabBarController,
    Selector,
    UITabBarController,
    UITab
  ) -> Bool = { controller, _, tabBarController, tab in
    let viewController = tab.viewController
      ?? controller.viewControllers?.first(where: {
        $0.tabBarItem.title == tab.title || $0.title == tab.title
      })

    guard let viewController,
          let screenClass = NSClassFromString("RNSTabsScreenViewController"),
          viewController.isKind(of: screenClass)
    else {
      return true
    }

    let legacy = NSSelectorFromString("tabBarController:shouldSelectViewController:")
    guard controller.responds(to: legacy),
          let imp = class_getMethodImplementation(object_getClass(controller), legacy)
    else {
      return true
    }

    typealias LegacyFn = @convention(c) (
      AnyObject,
      Selector,
      UITabBarController,
      UIViewController
    ) -> Bool
    let fn = unsafeBitCast(imp, to: LegacyFn.self)
    return fn(controller, legacy, tabBarController, viewController)
  }

  class_addMethod(
    cls,
    selector,
    unsafeBitCast(handle, to: IMP.self),
    "B@:@@"
  )
}

extension UITabBarController {
  @objc func wavelength_setViewControllers(
    _ viewControllers: [UIViewController]?,
    animated: Bool
  ) {
    if WavelengthTabBar.isApplyingTabs {
      wavelength_setViewControllers(viewControllers, animated: animated)
      return
    }

    wavelength_setViewControllers(viewControllers, animated: animated)

    guard #available(iOS 18.0, *) else {
      return
    }

    let screens = viewControllers
    DispatchQueue.main.async { [weak self] in
      _ = self?.wavelength_installRecordTabs(screens, animated: false)
    }
  }

  @available(iOS 18.0, *)
  @discardableResult
  private func wavelength_installRecordTabs(
    _ viewControllers: [UIViewController]?,
    animated: Bool
  ) -> Bool {
    guard let viewControllers,
          viewControllers.contains(where: { $0.tabBarItem.title == wavelengthRecordTabTitle })
    else {
      return false
    }

    if !tabs.isEmpty {
      wavelength_syncTabItems(from: viewControllers)
      if let recordTab = tabs.first(where: { $0.title == wavelengthRecordTabTitle }) {
        recordTab.preferredPlacement = .pinned
        if #available(iOS 27.0, *) {
          prominentTabIdentifier = recordTab.identifier
        }
        return true
      }
    }

    let wrapped = viewControllers.map { viewController -> UITab in
      let title = viewController.tabBarItem.title ?? ""
      let isRecord = title == wavelengthRecordTabTitle
      let tab = UITab(
        title: title,
        image: isRecord
          ? UIImage(systemName: wavelengthRecordTabSymbol)
          : viewController.tabBarItem.image,
        identifier: title
      ) { _ in viewController }

      if isRecord {
        tab.preferredPlacement = .pinned
      }

      if #available(iOS 26.1, *), !isRecord {
        tab.selectedImage = viewController.tabBarItem.selectedImage
      }

      return tab
    }

    WavelengthTabBar.isApplyingTabs = true
    setTabs(wrapped, animated: animated)
    WavelengthTabBar.isApplyingTabs = false

    if #available(iOS 27.0, *) {
      prominentTabIdentifier = wavelengthRecordTabTitle
    }
    return !tabs.isEmpty
  }

  @available(iOS 18.0, *)
  private func wavelength_syncTabItems(from viewControllers: [UIViewController]) {
    for viewController in viewControllers {
      let title = viewController.tabBarItem.title ?? ""
      guard let tab = tabs.first(where: {
        $0.identifier == title || $0.title == title
      }) else {
        continue
      }

      tab.title = title
      if let image = viewController.tabBarItem.image {
        tab.image = image
      }
      if #available(iOS 26.1, *), let selectedImage = viewController.tabBarItem.selectedImage {
        tab.selectedImage = selectedImage
      }
      if title == wavelengthRecordTabTitle {
        tab.preferredPlacement = .pinned
        tab.image = UIImage(systemName: wavelengthRecordTabSymbol)
      }
    }
  }
}

@objc(SceneDelegate)
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    WavelengthTabBar.install()

    guard let windowScene = scene as? UIWindowScene else {
      return
    }
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else {
      return
    }
    guard let factory = appDelegate.reactNativeFactory else {
      return
    }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate.window = window

    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions(from: connectionOptions)
    )
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let url = URLContexts.first?.url else {
      return
    }
    RCTLinkingManager.application(UIApplication.shared, open: url, options: [:])
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    RCTLinkingManager.application(
      UIApplication.shared,
      continue: userActivity,
      restorationHandler: { _ in }
    )
  }

  private func launchOptions(
    from connectionOptions: UIScene.ConnectionOptions
  ) -> [UIApplication.LaunchOptionsKey: Any]? {
    if let url = connectionOptions.urlContexts.first?.url {
      return [.url: url]
    }

    if let userActivity = connectionOptions.userActivities.first {
      return [
        .userActivityType: userActivity.activityType,
        .userActivityDictionary: [
          "UIApplicationLaunchOptionsUserActivityTypeKey": userActivity.activityType,
          "UIApplicationLaunchOptionsUserActivityKey": userActivity,
        ],
      ]
    }

    return nil
  }
}
