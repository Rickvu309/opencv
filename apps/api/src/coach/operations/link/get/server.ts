import { operation } from "@workspace/domain/operations/link/get"
import type { OperationBinding } from "../../../../registry/bind.js"

function hostOf(url: string) {
  try {
    return new URL(url).host
  } catch {
    return ""
  }
}

export const implementation = {
  operation,
  execute: (input) => ({ url: input.url, host: hostOf(input.url) }),
} satisfies OperationBinding<typeof operation>
