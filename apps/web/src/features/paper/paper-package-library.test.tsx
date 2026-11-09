import { afterEach, expect, it, vi } from "vitest"
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react"
import {
  paperPackageMetadataSchema,
  paperPackageReadSchema,
} from "@workspace/domain"

import { render } from "@/test/render-with-client.tsx"
import {
  PaperPackageLibrary,
  useWordLibrary,
} from "./paper-package-library.tsx"

const document = paperPackageMetadataSchema.parse({
  generation: "package",
  docId: "11111111-1111-4111-8111-111111111111",
  revision: "22222222-2222-4222-8222-222222222222",
  name: "Original Letter.docx",
  kind: "letter",
  packageHash: "a".repeat(64),
  byteSize: 1200,
})

function page(text: string, nextCursor: string | null = null) {
  return paperPackageReadSchema.parse({
    ...document,
    projector: "paper-package-spans-1",
    regions: [
      {
        kind: "locked",
        text,
        location: { paragraph: 0, kind: "paragraph" },
        reason: {
          code: "MIXED",
          message: "This text cannot be safely changed yet.",
        },
        complete: true,
        continuation: false,
      },
    ],
    nextCursor,
  })
}

function Harness() {
  const library = useWordLibrary("all", "")
  return <PaperPackageLibrary library={library} />
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it("pins every preview page and download to the selected saved revision", async () => {
  const fetchMock = vi.fn<typeof fetch>(async (url, init) => {
    const input: unknown = JSON.parse(String(init?.body))
    if (String(url).endsWith("/api/reads/paper.export")) {
      expect(input).toEqual({ docId: document.docId, at: document.revision })
      return Response.json({
        ok: true,
        data: {
          ...document,
          downloadPath: `/api/paper/packages/${document.docId}/export?at=${document.revision}`,
        },
      })
    }
    expect(String(url)).toContain("/api/reads/paper.read")
    if (input && typeof input === "object" && "view" in input)
      return Response.json({
        ok: true,
        data: { items: [document], next: null },
      })
    expect(input).toMatchObject({
      docId: document.docId,
      at: document.revision,
    })
    const continuation = input && typeof input === "object" && "cursor" in input
    return Response.json({
      ok: true,
      data: continuation
        ? page("Second saved paragraph")
        : page("First saved paragraph", "pinned-next-page"),
    })
  })
  vi.stubGlobal("fetch", fetchMock)
  render(<Harness />)
  fireEvent.click(await screen.findByRole("button", { name: document.name }))
  expect(await screen.findByText("First saved paragraph")).toBeVisible()
  expect(
    screen.getByText("This text cannot be safely changed yet.")
  ).toBeVisible()
  expect(
    await screen.findByRole("link", { name: "Download Word" })
  ).toHaveAttribute("href", expect.stringContaining(`at=${document.revision}`))
  fireEvent.click(screen.getByRole("button", { name: "Next page" }))
  expect(await screen.findByText("Second saved paragraph")).toBeVisible()
  expect(screen.queryByText("First saved paragraph")).not.toBeInTheDocument()
  expect(
    fetchMock.mock.calls.some(([, init]) =>
      String(init?.body).includes('"cursor":"pinned-next-page"')
    )
  ).toBe(true)
})

it("keeps unavailable pinned content unavailable instead of loading a newer head", async () => {
  const inputs: unknown[] = []
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async (_url, init) => {
      const input: unknown = JSON.parse(String(init?.body))
      inputs.push(input)
      return input && typeof input === "object" && "view" in input
        ? Response.json({ ok: true, data: { items: [document], next: null } })
        : Response.json(
            {
              ok: false,
              error: { code: "NOT_FOUND", message: "Unavailable version" },
            },
            { status: 404 }
          )
    })
  )
  render(<Harness />)
  fireEvent.click(await screen.findByRole("button", { name: document.name }))
  expect(
    await screen.findByText(
      "Could not load this saved version. Your file has not changed."
    )
  ).toBeVisible()
  expect(
    screen.queryByRole("link", { name: "Download Word" })
  ).not.toBeInTheDocument()
  expect(
    inputs.filter(
      (input) => input && typeof input === "object" && "docId" in input
    )
  ).toEqual([
    { docId: document.docId, at: document.revision },
    { docId: document.docId, at: document.revision },
  ])
})

it("keeps the disabled package library out of the legacy screen", async () => {
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      Response.json(
        { ok: false, error: { code: "NOT_FOUND", message: "Disabled" } },
        { status: 404 }
      )
    )
  vi.stubGlobal("fetch", fetchMock)
  render(<Harness />)
  await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
  await waitFor(() =>
    expect(screen.queryByText("Loading Word documents")).not.toBeInTheDocument()
  )
  expect(
    screen.queryByRole("region", { name: "Word documents" })
  ).not.toBeInTheDocument()
})
