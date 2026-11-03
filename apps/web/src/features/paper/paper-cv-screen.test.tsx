import { act, cleanup, fireEvent, screen } from "@testing-library/react"
import { blankCv } from "@workspace/domain"
import {
  SERVER_ORIGIN,
  writeDocument,
  type PaperClient,
} from "@workspace/paper-crdt"
import { afterEach, beforeAll, expect, it, vi } from "vitest"

import { installEditorPolyfills } from "@/test/paper-engine-kit.tsx"
import { seededCvClient } from "@/test/paper-fixture.ts"
import { pages, record, render } from "./paper-editor.fixtures.tsx"

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
  const name = screen.getByRole("textbox", { name: "Full name" })
  fireEvent.input(name, { target: { value: "Nia" } })
  expect(JSON.stringify(client.document())).toContain("Nia")
  expect(client.hasPending()).toBe(true)
  const prepared = client.prepare()
  expect(prepared.update.byteLength).toBeGreaterThan(0)
  act(() => {
    const current = client.document()
    if (!current || current.kind !== "cv") throw new Error("missing cv")
    writeDocument(
      client.ydoc,
      {
        ...current,
        header: { ...current.header, email: "coach@example.com" },
      },
      SERVER_ORIGIN
    )
  })
  const text = JSON.stringify(client.document())
  expect(text).toContain("Nia")
  expect(text).toContain("coach@example.com")
})
