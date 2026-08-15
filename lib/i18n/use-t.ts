"use client";

import type { Msg } from "./locale";
import { messages } from "./messages";

/**
 * Catalog access. `t` is identity: copy is already a string.
 *
 * Usage stays one line at the call site:
 *
 * ```tsx
 * const { t, m } = useT();
 * <Button>{t(m.common.save)}</Button>
 * ```
 */
export function useT(): {
  t: (entry: Msg) => string;
  m: typeof messages;
} {
  return { t: (entry) => entry, m: messages };
}
