import React from 'react';

export const SidebarVisibleContext = React.createContext(false);
export const SidebarNavigationContext = React.createContext(null);

// Screens keep their own recording/editor state and report it when the sidebar is used.
export function use_sidebar_navigation_guard(route_key, guard) {
  const register_guard = React.useContext(SidebarNavigationContext);
  const guard_ref = React.useRef(guard);
  guard_ref.current = guard;

  React.useLayoutEffect(() => {
    if (register_guard) {
      return register_guard(route_key, () => guard_ref.current());
    }
  }, [register_guard, route_key]);
}
