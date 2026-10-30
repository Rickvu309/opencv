import { afterEach, expect, it, vi } from "vitest"
import {
  act,
  cleanup,
  fireEvent,
  screen,
  within,
  waitFor,
} from "@testing-library/react"

import type { PaperView } from "@workspace/domain"

import { PaperCvEditor } from "./paper-editor.tsx"
import { render, record, pages, ok } from "./paper-editor.fixtures.tsx"

const savedCv: PaperView = {
  ...record,
  document: {
    version: 2,
    header: { name: "Ada", email: "", phone: "", city: "", linkedin: "" },
    sections: [
      {
        id: "experience",
        kind: "experience",
        blocks: [
          {
            id: "role",
            type: "experience-entry",
            role: "Beta",
            company: "Acme",
            period: "2024",
            bullets: [],
          },
        ],
      },
    ],
  },
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it("undoes a text transaction and disables Undo when history is empty", () => {
  vi.stubGlobal("fetch", () =>
    Promise.resolve(ok({ ...savedCv, contentVersion: 2 }))
  )
  render(
    <PaperCvEditor
      initial={savedCv}
      pages={pages(1)}
      onBack={() => undefined}
    />
  )
  const undo = screen.getByRole("button", { name: "Undo" })
  expect(undo).toBeDisabled()
  const role = screen.getByRole("textbox", { name: "Role" })
  const original = role.textContent
  fireEvent.focus(role)
  for (const value of ["G", "Ga", "Gamma"]) {
    role.textContent = value
    fireEvent.input(role)
  }
  fireEvent.blur(role)
  expect(undo).toBeEnabled()
  undo.focus()
  fireEvent.click(undo)
  expect(screen.getByRole("textbox", { name: "Role" }).textContent).toBe(
    original
  )
  expect(undo).toBeDisabled()
})

it("undoes later typing before an earlier duplicated block", async () => {
  vi.stubGlobal("fetch", () =>
    Promise.resolve(ok({ ...savedCv, contentVersion: 2 }))
  )
  render(
    <PaperCvEditor
      initial={savedCv}
      pages={pages(1)}
      onBack={() => undefined}
    />
  )
  const role = screen.getByRole("textbox", { name: "Role" })
  const block = role.closest<HTMLElement>("[data-sortable-block]")
  if (!block) throw new Error("Role block missing")
  fireEvent.click(within(block).getByRole("button", { name: "Block menu" }))
  fireEvent.click(await screen.findByRole("menuitem", { name: /Duplicate/ }))
  expect(screen.getAllByRole("textbox", { name: "Role" })).toHaveLength(2)
  const first = screen.getAllByRole("textbox", { name: "Role" }).at(0)
  if (!first) throw new Error("Duplicated role missing")
  const original = first.textContent
  fireEvent.focus(first)
  first.textContent = "Gamma"
  fireEvent.input(first)
  fireEvent.blur(first)
  const undo = screen.getByRole("button", { name: "Undo" })
  undo.focus()
  fireEvent.click(undo)
  const roles = screen.getAllByRole("textbox", { name: "Role" })
  expect(roles).toHaveLength(2)
  expect(roles.at(0)?.textContent).toBe(original)
  expect(undo).toBeEnabled()
  fireEvent.click(undo)
  expect(screen.getAllByRole("textbox", { name: "Role" })).toHaveLength(1)
  expect(undo).toBeDisabled()
})

it.each(["Role", "Company"])(
  "keeps separate edits to %s in order across autosave",
  async (secondField) => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(ok({ ...savedCv, contentVersion: 2 }))
    )
    render(
      <PaperCvEditor
        initial={savedCv}
        pages={pages(1)}
        onBack={() => undefined}
      />
    )
    vi.useFakeTimers()
    const role = screen.getByRole("textbox", { name: "Role" })
    fireEvent.focus(role)
    role.textContent = "Gamma"
    fireEvent.input(role)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700)
    })
    fireEvent.blur(role)
    const next = screen.getByRole("textbox", { name: secondField })
    fireEvent.focus(next)
    next.textContent = "Delta"
    fireEvent.input(next)
    fireEvent.blur(next)
    const undo = screen.getByRole("button", { name: "Undo" })
    undo.focus()
    fireEvent.click(undo)
    expect(screen.getByRole("textbox", { name: "Role" }).textContent).toBe(
      "Gamma"
    )
    expect(screen.getByRole("textbox", { name: "Company" }).textContent).toBe(
      "Acme"
    )
    expect(undo).toBeEnabled()
    fireEvent.click(undo)
    expect(screen.getByRole("textbox", { name: "Role" }).textContent).toBe(
      "Beta"
    )
    expect(undo).toBeDisabled()
  }
)

it("keeps one typing transaction across an autosave acknowledgment", async () => {
  vi.stubGlobal("fetch", () =>
    Promise.resolve(ok({ ...savedCv, contentVersion: 2 }))
  )
  render(
    <PaperCvEditor
      initial={savedCv}
      pages={pages(1)}
      onBack={() => undefined}
    />
  )
  vi.useFakeTimers()
  const role = screen.getByRole("textbox", { name: "Role" })
  fireEvent.focus(role)
  role.textContent = "Gam"
  fireEvent.input(role)
  await act(async () => {
    await vi.advanceTimersByTimeAsync(700)
  })
  role.textContent = "Gamma"
  fireEvent.input(role)
  fireEvent.blur(role)
  const undo = screen.getByRole("button", { name: "Undo" })
  undo.focus()
  fireEvent.click(undo)
  expect(screen.getByRole("textbox", { name: "Role" }).textContent).toBe("Beta")
  expect(undo).toBeDisabled()
})

it("discards old Undo history when a newer saved document is adopted", async () => {
  vi.stubGlobal("fetch", () =>
    Promise.resolve(ok({ ...savedCv, contentVersion: 2 }))
  )
  const view = render(
    <PaperCvEditor
      initial={savedCv}
      pages={pages(1)}
      onBack={() => undefined}
    />
  )
  vi.useFakeTimers()
  const role = screen.getByRole("textbox", { name: "Role" })
  fireEvent.focus(role)
  role.textContent = "Gamma"
  fireEvent.input(role)
  fireEvent.blur(role)
  await act(async () => {
    await vi.advanceTimersByTimeAsync(700)
  })
  expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled()
  view.rerender(
    <PaperCvEditor
      initial={{ ...savedCv, contentVersion: 3 }}
      pages={pages(1)}
      onBack={() => undefined}
    />
  )
  expect(screen.getByRole("textbox", { name: "Role" }).textContent).toBe("Beta")
  expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled()
})

it("preserves a newly attached photo when undoing older text", async () => {
  const fileId = "11111111-1111-4111-8111-111111111111"
  vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes("/api/commands/paper.attachPhoto"))
      return Promise.resolve(ok({ ...savedCv, contentVersion: 3 }))
    if (url.includes("/api/paper/files"))
      return Promise.resolve(ok({ id: fileId }))
    return Promise.resolve(ok({ ...savedCv, contentVersion: 2 }))
  })
  const view = render(
    <PaperCvEditor
      initial={{ ...savedCv, templateId: "with-photo" }}
      pages={pages(1)}
      onBack={() => undefined}
    />
  )
  const role = screen.getByRole("textbox", { name: "Role" })
  fireEvent.focus(role)
  role.textContent = "Gamma"
  fireEvent.input(role)
  fireEvent.blur(role)
  const input =
    view.container.querySelector<HTMLInputElement>('input[type="file"]')
  if (!input) throw new Error("Photo upload input missing")
  fireEvent.change(input, {
    target: { files: [new File(["photo"], "face.png", { type: "image/png" })] },
  })
  await waitFor(() =>
    expect(view.container.querySelector("img")?.getAttribute("src")).toContain(
      fileId
    )
  )
  const undo = screen.getByRole("button", { name: "Undo" })
  undo.focus()
  fireEvent.click(undo)
  expect(screen.getByRole("textbox", { name: "Role" }).textContent).toBe("Beta")
  expect(view.container.querySelector("img")?.getAttribute("src")).toContain(
    fileId
  )
  expect(undo).toBeDisabled()
})
