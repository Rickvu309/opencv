import { afterEach, beforeEach, vi } from "vitest"
import { TextSelection } from "@tiptap/pm/state"
import { richPaperDocumentSchema, nativeProvenance } from "@workspace/domain"
import type { RichPaperDocument } from "@workspace/domain"
import { openRichPaperClient, type PaperClient } from "./client.js"
import { seedStoredYDoc } from "./stored-document.js"
import { borrowFlowDocument } from "./native-layout-flow.js"
import { mountPrivateFlow } from "./native-layout-flow-mount.js"
import { storedFlowFixture } from "./test/flow-fixture.js"

export const cleanups: (() => void)[] = []
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    }
  )
  const fonts = Object.getOwnPropertyDescriptor(document, "fonts")
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { ready: Promise.resolve() },
  })
  cleanups.push(() => {
    if (fonts) Object.defineProperty(document, "fonts", fonts)
    else Reflect.deleteProperty(document, "fonts")
  })
})
afterEach(() => {
  for (const cleanup of cleanups.reverse()) cleanup()
  cleanups.length = 0
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
export function setup(kind: "cv" | "letter") {
  const input = storedFlowFixture(kind)
  const document = richPaperDocumentSchema.parse({
    ...input,
    flow: {
      ...input.flow,
      children: input.flow.children.map((section) => ({
        ...section,
        children: section.children.filter(
          (node) => node.type === "paragraph" || node.type === "header"
        ),
      })),
    },
  })
  const provenance = nativeProvenance(document)
  const client = openRichPaperClient(
    {
      epoch: 1,
      revision: 0,
      provenance,
      server: seedStoredYDoc(document),
      pending: Uint8Array.of(0, 0),
    },
    { provenance }
  )
  cleanups.push(() => client.destroy())
  const host = globalThis.document.createElement("div")
  globalThis.document.body.append(host)
  cleanups.push(() => host.remove())
  const lease = borrowFlowDocument(client.ydoc, kind)
  cleanups.push(() => lease.release())
  const mounted = mountPrivateFlow(lease.binding, host)
  cleanups.push(() => mounted.unmount())
  const view = mounted.editor.prosemirrorView
  function select(from = "intro", to = from, start = 0, end?: number) {
    mounted.editor.setTextCursorPosition(from, "start")
    const anchor = view.state.selection.from + start
    mounted.editor.setTextCursorPosition(to, "end")
    view.dispatch(
      view.state.tr.setSelection(
        TextSelection.create(
          view.state.doc,
          anchor,
          end === undefined ? view.state.selection.to : anchor + end
        )
      )
    )
  }
  select()
  return { client, mounted, view, select, host }
}
export function paragraph(
  client: PaperClient<RichPaperDocument>,
  id = "intro"
) {
  const result = client
    .document()
    ?.flow.children[0]?.children.find((node) => node.id === id)
  if (result?.type !== "paragraph") throw new Error("Missing paragraph")
  return result
}
