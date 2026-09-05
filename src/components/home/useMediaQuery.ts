"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Subscribe to a media query.
 *
 * `useSyncExternalStore` rather than the usual effect-plus-setState: the media
 * query IS external state, and reading it this way avoids the cascading render
 * that `react-hooks/set-state-in-effect` warns about. It also means a reader
 * who changes their motion preference while the page is open gets the new
 * behaviour immediately, instead of only on reload.
 *
 * The server snapshot is always `false`, so anything gated on a query renders
 * in its plainest form until the client says otherwise.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );

  const getSnapshot = useCallback(
    () => window.matchMedia(query).matches,
    [query],
  );

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
