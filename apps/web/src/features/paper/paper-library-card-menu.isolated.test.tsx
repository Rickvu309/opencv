import { activityFeedRow } from "@/test/control-fixtures.ts"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { type PaperView } from "@workspace/domain/paper-doc"

vi.mock("@/features/apply/apply-api.ts", () => ({
  listJobs: vi.fn(() => Promise.resolve([])),
}))
import { cv, letter, renderLibrary } from "./paper-library.fixtures.tsx"
import { paperUpdateResult } from "@/test/paper-api-mock.ts"

vi.mock("./paper-api.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./paper-api.ts")>()),
  importPaperFile: vi.fn(),
  importPaperLink: vi.fn(),
}))

async function openRename(doc: PaperView) {
  const user = userEvent.setup()
  renderLibrary([doc])
  await user.click(
    screen.getByRole("button", {
      name: `${doc.name.replace(/\.(docx?|pdf)$/i, "")} menu`,
    })
  )
  await user.click(await screen.findByRole("menuitem", { name: "Rename" }))
  return user
}

function renameCommands(fetchMock: ReturnType<typeof vi.fn<typeof fetch>>) {
  return fetchMock.mock.calls
    .filter(([url]) => String(url).endsWith("/api/commands/paper.update"))
    .map(([, init]) => JSON.parse(String(init?.body)))
}

afterEach(() => {
  document.body.removeAttribute("data-print")
  cleanup()
  vi.clearAllMocks()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("Paper library card menu", () => {
  it("exposes Rename and Delete on the card menu", async () => {
    renderLibrary([cv("PM track CV")])
    fireEvent.click(screen.getByRole("button", { name: "PM track CV menu" }))
    const menu = await screen.findByRole("menu")
    expect(menu).toHaveTextContent("Rename")
    expect(menu).toHaveTextContent("Delete")
  })

  it.each([
    ["CV", cv("CV draft")],
    ["cover letter", letter("Letter draft")],
  ] as const)("submits a %s rename with Enter", async (_kind, doc) => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(() =>
        Promise.resolve(
          Response.json(paperUpdateResult(doc.id, "Updated name", doc.kind))
        )
      )
    vi.stubGlobal("fetch", fetchMock)
    const user = await openRename(doc)
    const field = screen.getByRole("textbox", { name: "Name" })
    await user.clear(field)
    await user.type(field, "  Updated name  ")
    await user.keyboard("{Enter}")

    await vi.waitFor(() => {
      expect(renameCommands(fetchMock)).toHaveLength(1)
    })
    expect(renameCommands(fetchMock)[0]).toMatchObject({
      input: { docId: doc.id, patch: { name: "Updated name" } },
    })
    await vi.waitFor(() => {
      expect(
        screen.queryByRole("textbox", { name: "Name" })
      ).not.toBeInTheDocument()
    })
  })

  it.each([
    ["CV", cv("CV draft")],
    ["cover letter", letter("Letter draft")],
  ] as const)(
    "keeps a %s rename draft on Enter validation errors",
    async (_kind, doc) => {
      const fetchMock = vi.fn<typeof fetch>()
      vi.stubGlobal("fetch", fetchMock)
      const user = await openRename(doc)
      const field = screen.getByRole("textbox", { name: "Name" })

      for (const [value, error] of [
        ["", "Name is required"],
        ["A".repeat(201), "Name is too long"],
      ]) {
        await user.clear(field)
        if (value !== "") await user.type(field, value)
        await user.keyboard("{Enter}")
        expect(await screen.findByText(error)).toBeInTheDocument()
        expect(screen.getByRole("alert")).toHaveTextContent(error)
        expect(field).toHaveAttribute("aria-invalid", "true")
        expect(field).toHaveAttribute("aria-describedby", "paper-rename-error")
        expect(field).toHaveValue(value)
        expect(
          screen.getByRole("textbox", { name: "Name" })
        ).toBeInTheDocument()
        expect(renameCommands(fetchMock)).toHaveLength(0)
      }
    }
  )

  it.each([["a Paper", {}, false]] as const)(
    "deletes %s from the card menu and offers Undo only when it can be undone",
    async (_kind, extra, undoable) => {
      const doc = cv("Word CV")
      const activityId = "55555555-5555-4555-8555-555555555555"
      const fetchMock = vi.fn<typeof fetch>().mockImplementation((url) => {
        const path = String(url).split("?")[0] ?? ""
        if (path.endsWith("/api/commands/paper.delete"))
          return Promise.resolve(
            Response.json({ ok: true, data: { id: doc.id, ...extra } })
          )
        if (path.endsWith("/api/reads/activity.list"))
          return Promise.resolve(
            Response.json({
              ok: true,
              data: [activityFeedRow({ id: activityId, subjectId: doc.id })],
            })
          )
        return Promise.resolve(Response.json({ ok: true, data: [] }))
      })
      vi.stubGlobal("fetch", fetchMock)
      const user = userEvent.setup()
      renderLibrary([doc])
      await user.click(
        screen.getByRole("button", {
          name: `${doc.name.replace(/\.(docx?|pdf)$/i, "")} menu`,
        })
      )
      await user.click(await screen.findByRole("menuitem", { name: "Delete" }))
      expect(
        await screen.findByText(
          undoable
            ? "You can undo this from the message that follows."
            : "This can't be undone."
        )
      ).toBeInTheDocument()
      await user.click(await screen.findByRole("button", { name: "Delete" }))
      await vi.waitFor(() => {
        expect(
          fetchMock.mock.calls.some(([url]) =>
            String(url).endsWith("/api/commands/paper.delete")
          )
        ).toBe(true)
      })
      const askedForUndo = () =>
        fetchMock.mock.calls.some(([url]) =>
          String(url).endsWith("/api/reads/activity.list")
        )
      if (undoable) await vi.waitFor(() => expect(askedForUndo()).toBe(true))
      else {
        await vi.waitFor(() =>
          expect(
            screen.queryByRole("button", { name: "Delete" })
          ).not.toBeInTheDocument()
        )
        expect(askedForUndo()).toBe(false)
      }
    }
  )
})
