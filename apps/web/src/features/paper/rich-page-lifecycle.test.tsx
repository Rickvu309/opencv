import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { act, fireEvent, screen, waitFor } from "@testing-library/react"
import * as Y from "yjs"
import {
  nativeProvenance,
  parsePaperId,
  RICH_NATIVE_WRITER,
} from "@workspace/domain"
import {
  emptyUpdate,
  openRichPaperClient,
  seedStoredYDoc,
} from "@workspace/paper-crdt"
import { openRichPaperSession } from "@/lib/paper-rich.ts"
import { render } from "@/test/render-with-client.tsx"
import { storedFlowFixture } from "../../../../../packages/paper-crdt/src/test/flow-fixture.ts"
import { RichPaperPage } from "./rich-page.tsx"

vi.mock("@/lib/paper-rich.ts", () => ({ openRichPaperSession: vi.fn() }))

const cleanups = new Set<() => void>()
beforeEach(() => {
  vi.stubGlobal("ClipboardEvent", class extends Event {})
  Object.defineProperties(Range.prototype, {
    getClientRects: { configurable: true, value: () => [] },
    getBoundingClientRect: { configurable: true, value: () => new DOMRect() },
  })
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { ready: Promise.resolve() },
  })
})
afterEach(() => {
  for (const cleanup of cleanups) cleanup()
  cleanups.clear()
  vi.unstubAllGlobals()
})

function paste(host: HTMLElement, words: string) {
  const event = new Event("paste", { bubbles: true, cancelable: true })
  Object.defineProperty(event, "clipboardData", {
    value: {
      getData: (name: string) => (name === "text/plain" ? words : ""),
      types: ["text/plain"],
      files: [],
    },
  })
  fireEvent(host, event)
}

it.each([
  ["cv", "rebuild"],
  ["letter", "rebuild"],
  ["cv", "rebase"],
  ["letter", "rebase"],
] as const)("keeps the %s page usable after a %s", async (kind, mode) => {
  const initial = storedFlowFixture(kind)
  const provenance = nativeProvenance(initial)
  const remote = new Y.Doc()
  Y.applyUpdate(remote, seedStoredYDoc(initial))
  const client = openRichPaperClient(
    {
      epoch: 1,
      revision: 0,
      provenance,
      server: Y.encodeStateAsUpdate(remote),
      pending: emptyUpdate(),
    },
    { provenance }
  )
  cleanups.add(() => {
    client.destroy()
    remote.destroy()
  })
  vi.mocked(openRichPaperSession).mockReturnValue({
    initialized: Promise.resolve(),
    status: () => "saved",
    ready: () => true,
    client: () => client,
    subscribe: () => () => {},
    flush: async () => {},
    persist: async () => {},
    destroy: async () => {
      client.destroy()
    },
  })
  render(
    <RichPaperPage
      name={`My ${kind}`}
      identity={{
        kind: "native",
        ownerId: "lifecycle",
        sessionId: "lifecycle",
        docId: parsePaperId("15900000-0000-4000-8000-000000000001"),
        provenance,
        writer: RICH_NATIVE_WRITER,
      }}
      onBack={() => {}}
    />
  )
  const host = await screen.findByLabelText("Document content")
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Bold", exact: true })
    ).toBeEnabled()
  )
  act(() => {
    host.focus()
    paste(host, "Unsaved Việt 😀 ")
  })
  await waitFor(() =>
    expect(JSON.stringify(client.document())).toContain("Unsaved Việt 😀")
  )
  const pending = client.stored().pending
  const reply = (reset: boolean) => ({
    provenance,
    epoch: reset ? 2 : 1,
    revision: 1,
    reset,
    stale: false,
    update: Y.encodeStateAsUpdate(remote),
    stateVector: Y.encodeStateVector(remote),
  })
  if (mode === "rebase") {
    const rejected = client.receive(client.prepare(), reply(true))
    expect(rejected.failed).toBe(true)
    expect(client.stored().pending).toEqual(pending)
    expect(host.childElementCount).toBeGreaterThan(0)
  }
  const sent = client.prepare()
  Y.applyUpdate(remote, sent.update)
  act(() => {
    expect(client.receive(sent, reply(false)).failed).toBe(false)
  })
  const oldDocument = client.ydoc
  const selected = window.getSelection()
  const selection = {
    anchor: selected?.anchorNode?.textContent,
    anchorOffset: selected?.anchorOffset,
    focus: selected?.focusNode?.textContent,
    focusOffset: selected?.focusOffset,
  }
  act(() => {
    expect(client.receive(client.prepare(), reply(true)).failed).toBe(false)
  })
  expect(client.ydoc).not.toBe(oldDocument)
  await waitFor(() => expect(host.childElementCount).toBeGreaterThan(0))
  expect(host.textContent).toContain("Unsaved Việt 😀")
  expect({
    anchor: window.getSelection()?.anchorNode?.textContent,
    anchorOffset: window.getSelection()?.anchorOffset,
    focus: window.getSelection()?.focusNode?.textContent,
    focusOffset: window.getSelection()?.focusOffset,
  }).toEqual(selection)
  expect(document.activeElement).toBe(host)
  fireEvent.click(screen.getByRole("button", { name: "Bold", exact: true }))
  act(() => paste(host, "After sync "))
  await waitFor(() =>
    expect(JSON.stringify(client.document())).toContain("After sync")
  )
  expect(client.hasPending()).toBe(true)
  act(() => client.destroy())
  expect(
    screen.getByRole("button", { name: "Bold", exact: true })
  ).toBeDisabled()
})
