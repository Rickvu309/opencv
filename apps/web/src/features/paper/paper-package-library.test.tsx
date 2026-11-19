import { afterEach, expect, it, vi } from "vitest"
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react"
import {
  paperPackageMetadataSchema,
  paperPackageReadSchema,
} from "@workspace/domain"

import { render } from "@/test/render-with-client.tsx"
import { ApiError } from "@/lib/api.ts"
import {
  PaperPackageLibrary,
  useWordLibrary,
} from "./paper-package-library.tsx"
import { LibraryEntryCard } from "./paper-library-sections.tsx"

const document = paperPackageMetadataSchema.parse({
  generation: "package",
  docId: "11111111-1111-4111-8111-111111111111",
  revision: "22222222-2222-4222-8222-222222222222",
  name: "Original Letter",
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

function Harness({
  onOpen = () => undefined,
}: {
  onOpen?: (docId: string) => void
}) {
  const library = useWordLibrary()
  return (
    <>
      <output aria-label="Word library read status">
        {library.query.error instanceof ApiError
          ? library.query.error.status
          : ""}
      </output>
      {library.items.map((word) => (
        <LibraryEntryCard
          key={word.docId}
          entry={{ type: "word", key: word.docId, word }}
          on={{ onOpen, onPreview: library.onSelect }}
        />
      ))}
      <PaperPackageLibrary library={library} />
    </>
  )
}

async function preview(name: string) {
  fireEvent.click(
    await screen.findByRole("button", {
      name: `${name} menu`,
    })
  )
  fireEvent.click(await screen.findByRole("menuitem", { name: "Preview text" }))
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
  await preview(document.name)
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
      if (!(
        input &&
        typeof input === "object" &&
        "view" in input &&
        input.view === "page"
      )) {
        inputs.push(input)
      }
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
  await screen.findByRole("button", { name: /Open / })
  await preview(document.name)
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

it("opens the saved page without leaving the preview", async () => {
  const opened: string[] = []
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async (_url, init) => {
      const input: unknown = JSON.parse(String(init?.body))
      if (input && typeof input === "object" && "view" in input) {
        return Response.json({
          ok: true,
          data: { items: [document], next: null },
        })
      }
      return Response.json({ ok: true, data: page("First saved paragraph") })
    })
  )
  render(
    <Harness
      onOpen={(id) => {
        opened.push(id)
      }}
    />
  )
  fireEvent.click(
    await screen.findByRole("button", {
      name: `Open ${document.name.replace(/\.docx$/i, "")}`,
    })
  )
  expect(opened).toEqual([document.docId])
  expect(screen.queryByText("First saved paragraph")).not.toBeInTheDocument()
  await preview(document.name)
  expect(await screen.findByText("First saved paragraph")).toBeVisible()
})

it("shows a Word library failure as an alert", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async () =>
      Response.json(
        { ok: false, error: { code: "INTERNAL", message: "Down" } },
        { status: 500 }
      )
    )
  )
  render(<Harness />)
  const alert = await screen.findByRole("alert")
  expect(alert).toHaveTextContent("Could not load Word documents.")
  expect(alert.className).toMatch(/text-destructive/)
})

it("keeps the disabled package library out of the legacy screen", async () => {
  const response = Promise.withResolvers<Response>()
  const fetchMock = vi.fn<typeof fetch>(() => response.promise)
  vi.stubGlobal("fetch", fetchMock)
  render(<Harness />)
  expect(screen.queryByText("Loading Word documents")).not.toBeInTheDocument()
  expect(
    screen.queryByRole("region", { name: "Word documents" })
  ).not.toBeInTheDocument()
  await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
  expect(
    screen.queryByRole("region", { name: "Word documents" })
  ).not.toBeInTheDocument()
  response.resolve(
    Response.json(
      { ok: false, error: { code: "NOT_FOUND", message: "Disabled" } },
      { status: 404 }
    )
  )
  await waitFor(() =>
    expect(screen.getByLabelText("Word library read status")).toHaveTextContent(
      "404"
    )
  )
  expect(
    screen.queryByRole("region", { name: "Word documents" })
  ).not.toBeInTheDocument()
})

it("requests the next library page and returns to the first page", async () => {
  const second = paperPackageMetadataSchema.parse({
    ...document,
    docId: "33333333-3333-4333-8333-333333333333",
    name: "Second Letter",
  })
  const inputs: unknown[] = []
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async (_url, init) => {
      const input: unknown = JSON.parse(String(init?.body))
      inputs.push(input)
      const after = input && typeof input === "object" && "after" in input
      return Response.json({
        ok: true,
        data: {
          items: [after ? second : document],
          next: after ? null : document.docId,
        },
      })
    })
  )
  render(<Harness />)
  expect(
    await screen.findByRole("button", {
      name: `Open ${document.name.replace(/\.docx$/i, "")}`,
    })
  ).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: "More documents" }))
  expect(
    await screen.findByRole("button", {
      name: `Open ${second.name.replace(/\.docx$/i, "")}`,
    })
  ).toBeVisible()
  expect(
    screen.queryByRole("button", {
      name: `Open ${document.name.replace(/\.docx$/i, "")}`,
    })
  ).not.toBeInTheDocument()
  expect(inputs).toContainEqual({ view: "library", after: document.docId })
  fireEvent.click(screen.getByRole("button", { name: "First documents" }))
  expect(
    await screen.findByRole("button", {
      name: `Open ${document.name.replace(/\.docx$/i, "")}`,
    })
  ).toBeVisible()
  await waitFor(() =>
    expect(
      inputs.filter((input) => JSON.stringify(input) === '{"view":"library"}')
    ).toHaveLength(2)
  )
  expect(
    screen.queryByRole("button", { name: "First documents" })
  ).not.toBeInTheDocument()
})
