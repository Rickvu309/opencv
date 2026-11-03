import { act, cleanup, fireEvent, screen } from "@testing-library/react"
import { blankCv } from "@workspace/domain"
import {
  SERVER_ORIGIN,
  writeDocument,
  type PaperClient,
} from "@workspace/paper-crdt"
import { afterEach, beforeAll, expect, it, vi } from "vitest"
import * as Y from "yjs"

import { installEditorPolyfills } from "@/test/paper-engine-kit.tsx"
import { seededCvClient } from "@/test/paper-fixture.ts"
import { pages, record, render } from "./paper-editor.fixtures.tsx"

import { cvEditorStatus } from "./paper-cv-bar.tsx"
import { PaperCvEditor } from "./paper-cv-editor.tsx"

const fixture = vi.hoisted(() => ({ client: null as PaperClient | null }))

vi.mock("@/lib/paper-sync.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paper-sync.ts")>()),
  usePaperSync: () => ({
    sync: { poke() {} },
    status: "saved" as const,
    generation: 1,
    client: fixture.client,
  }),
}))

beforeAll(() => {
  installEditorPolyfills()
  const base = blankCv()
  fixture.client = seededCvClient({
    ...base,
    blocks: [
      base.blocks[0],
      {
        id: "job-1",
        type: "experience",
        role: "",
        company: "",
        period: "",
        location: "",
        children: [],
      },
      ...base.blocks.slice(1),
    ],
  })
})

afterEach(() => cleanup())

it("sends typing through the sync client and keeps a Coach edit beside it", async () => {
  const client = fixture.client
  if (!client) throw new Error("missing client")
  render(
    <PaperCvEditor initial={record} pages={pages(1)} onBack={() => undefined} />
  )
  await act(async () => {
    await Promise.resolve()
  })
  const beforeTyping = client.document()
  if (!beforeTyping || beforeTyping.kind !== "cv") throw new Error("missing cv")
  const before = Y.encodeStateAsUpdate(client.ydoc)
  const name = screen.getByRole("textbox", { name: "Full name" })
  name.focus()
  fireEvent.input(name, { target: { value: "Nia" } })
  expect(JSON.stringify(client.document())).toContain("Nia")
  expect(client.hasPending()).toBe(true)
  const prepared = client.prepare()
  expect(prepared.update.byteLength).toBeGreaterThan(0)
  act(() => {
    const remote = new Y.Doc()
    Y.applyUpdate(remote, before)
    writeDocument(
      remote,
      {
        ...beforeTyping,
        header: { ...beforeTyping.header, email: "coach@example.com" },
      },
      "coach"
    )
    Y.applyUpdate(client.ydoc, Y.encodeStateAsUpdate(remote), SERVER_ORIGIN)
  })
  const email = screen.getByRole("textbox", {
    name: "Email",
  }) as HTMLInputElement
  expect((name as HTMLInputElement).value).toBe("Nia")
  expect(email.value).toBe("coach@example.com")
  expect(document.activeElement).toBe(name)
  const text = JSON.stringify(client.document())
  expect(text).toContain("Nia")
  expect(text).toContain("coach@example.com")
  const role = screen.getByRole("textbox", { name: "Role" }) as HTMLInputElement
  role.focus()
  expect(role.value).toBe("")
  act(() => {
    const current = client.document()
    if (!current || current.kind !== "cv") throw new Error("missing cv")
    writeDocument(
      client.ydoc,
      {
        ...current,
        blocks: current.blocks.map((block) =>
          block.id === "job-1" && block.type === "experience"
            ? { ...block, role: "Senior engineer" }
            : block
        ),
      },
      SERVER_ORIGIN
    )
  })
  expect(role.value).toBe("Senior engineer")
  fireEvent.blur(role)
  expect(role.value).toBe("Senior engineer")
  expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy()
  expect(screen.getByRole("button", { name: "Download PDF" })).toBeTruthy()
  expect(screen.getByRole("button", { name: "Coach" })).toBeTruthy()
  expect(
    document.querySelector(".bn-editor")?.getAttribute("aria-label")
  ).toContain("CV")
  const iso = new Date().toISOString()
  expect(cvEditorStatus("saving", iso, true)).not.toBe("Saving")
  expect(cvEditorStatus("saving", iso, false)).toBe("Saving")
})
