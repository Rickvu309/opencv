import * as React from "react";

const MOBILE_BREAKPOINT = 768;

/**
 * Whether the viewport is phone-sized.
 *
 * Reads the media query through `useSyncExternalStore` rather than mirroring it
 * into state from an effect. The server has no viewport and the client does,
 * which is a real asymmetry: `getServerSnapshot` answers `false` and the client
 * answers the truth on its first snapshot, instead of rendering one answer and
 * correcting it a frame later. Same shape as `lib/waitlist/use-local-flag.ts`
 * and `lib/actions/store.tsx`, for the same reason.
 */
const query = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(query);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

export function useIsMobile(): boolean {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
