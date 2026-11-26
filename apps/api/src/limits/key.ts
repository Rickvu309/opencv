import type { LimitScope } from "@workspace/domain/limits"

declare const limitKeyBrand: unique symbol

export type LimitKey = string & { readonly [limitKeyBrand]: true }

export function keyFor(scope: LimitScope, raw: string): LimitKey {
  const trimmed = raw.trim()
  if (!trimmed) throw new Error("A limit needs the signed-in account.")
  return `${scope}:${trimmed}` as LimitKey
}
