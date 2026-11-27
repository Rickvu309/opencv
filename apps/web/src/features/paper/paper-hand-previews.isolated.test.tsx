import { fireEvent, screen, waitFor } from "@testing-library/react"
import { catalog, parsePaperId } from "@workspace/domain/kernel"
import { expect, it, vi } from "vitest"

import { cv, renderLibrary } from "./paper-library.fixtures.tsx"

vi.mock("@/lib/owner-id.ts", () => ({ useOwnerId: () => "owner" }))

it("batches only the nearby engine 2 cards, including after jumping in the hand", async () => {
  const docs = Array.from({ length: 50 }, (_, index) => ({
    ...cv(`CV ${index + 1}`),
    id: parsePaperId(
      `15500000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`
    ),
    ...(index === 0 ? { preview: ["Legacy preview"] } : { engine: 2 as const }),
  }))
  const batches: string[][] = []
  const name = catalog["paper.firstPages"].name
  vi.stubGlobal("fetch", (url: URL, init?: RequestInit) => {
    if (url.pathname.endsWith(name)) {
      const { ids } = catalog[name].input.parse(JSON.parse(String(init?.body)))
      batches.push(ids)
    }
    return Promise.resolve(Response.json({ ok: true, data: [] }))
  })

  renderLibrary(docs)
  await waitFor(() =>
    expect(batches).toEqual([docs.slice(1, 6).map(({ id }) => id)])
  )
  expect(screen.getByText("Legacy preview")).toBeInTheDocument()

  fireEvent.keyDown(screen.getByRole("group", { name: "Your documents" }), {
    key: "End",
  })
  await waitFor(() =>
    expect(batches).toEqual([
      docs.slice(1, 6).map(({ id }) => id),
      docs.slice(-6).map(({ id }) => id),
    ])
  )
})
