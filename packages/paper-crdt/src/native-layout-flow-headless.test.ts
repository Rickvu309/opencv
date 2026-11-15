import { expect, it } from "vitest"
import * as Y from "yjs"
import {
  createPrivateFlow,
  openFlowBinary,
  readFlow,
} from "./native-layout-flow.js"
import { flowFixture } from "./test/flow-fixture.js"

it("roundtrips canonical page flow without browser globals", () => {
  expect(typeof globalThis.document).toBe("undefined")
  expect(typeof globalThis.window).toBe("undefined")
  const source = flowFixture()
  const result = createPrivateFlow(source)
  if (result.kind === "refused") throw new Error(result.reason)
  const binding = result.value
  try {
    expect(readFlow(binding)).toEqual(source)
    const reopened = openFlowBinary(
      Y.encodeStateAsUpdate(binding.doc),
      source.kind
    )
    try {
      expect(readFlow(reopened)).toEqual(source)
    } finally {
      reopened.engine._tiptapEditor.destroy()
      reopened.doc.destroy()
    }
  } finally {
    binding.engine._tiptapEditor.destroy()
    binding.doc.destroy()
  }
})
