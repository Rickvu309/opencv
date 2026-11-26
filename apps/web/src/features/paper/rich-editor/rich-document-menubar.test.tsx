import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { RichDocumentMenuBar } from "./rich-document-menubar.tsx"

afterEach(() => cleanup())

function bar() {
  const onFind = vi.fn()
  render(
    <RichDocumentMenuBar
      editor={null}
      session={null}
      status="saved"
      blocked={false}
      onFind={onFind}
    />
  )
  return { onFind }
}

it("groups the document commands under File, Edit and Insert", async () => {
  const { onFind } = bar()
  expect(screen.getByRole("group", { name: "Document menus" })).toBeVisible()
  expect(screen.getByRole("button", { name: "File" })).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: "Edit" }))
  fireEvent.click(await screen.findByRole("menuitem", { name: "Find" }))
  expect(onFind).toHaveBeenCalledWith("find")
  fireEvent.click(screen.getByRole("button", { name: "Insert" }))
  expect(
    await screen.findByRole("menuitem", { name: "Page break" })
  ).toHaveAttribute("aria-disabled", "true")
})

it("keeps the File commands in the menu bar", async () => {
  bar()
  fireEvent.click(screen.getByRole("button", { name: "File" }))
  expect(
    await screen.findByRole("menuitem", { name: "Page setup" })
  ).toHaveAttribute("aria-disabled", "true")
  expect(
    await screen.findByRole("menuitem", { name: "Download Word" })
  ).toHaveAttribute("aria-disabled", "true")
})
