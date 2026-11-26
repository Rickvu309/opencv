import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { Toaster } from "sonner"
import type { SyncStatus } from "@/lib/paper-sync-status.ts"
import { SavedRichWordChanged } from "@/lib/paper-rich-word.ts"
import { RichDocumentMenu } from "./rich-document-menu.tsx"

afterEach(() => cleanup())

function menu(status: SyncStatus = "saved", blocked = false) {
  let finish = () => {}
  let fail: (error: Error) => void = () => {}
  const downloadWord = vi.fn(
    () =>
      new Promise<void>((resolve, reject) => {
        finish = resolve
        fail = reject
      })
  )
  render(
    <>
      <RichDocumentMenu
        session={{ downloadWord }}
        status={status}
        blocked={blocked}
        editorAvailable
      />
      <Toaster />
    </>
  )
  fireEvent.click(screen.getByRole("button", { name: "Document menu" }))
  return {
    downloadWord,
    finish: () => finish(),
    fail: (error: Error) => fail(error),
  }
}

it.each([
  ["saving", false, "Wait until your changes are saved."],
  ["offline", false, "Wait until your changes are saved."],
  [
    "refused",
    false,
    "Paper couldn't prepare the Word file. Reload the page and try again.",
  ],
  [
    "stuck",
    false,
    "Paper couldn't prepare the Word file. Reload the page and try again.",
  ],
  [
    "saved",
    true,
    "Paper couldn't prepare the Word file. Reload the page and try again.",
  ],
] satisfies [SyncStatus, boolean, string][])(
  "explains the disabled %s state with an accessible hint",
  async (status, blocked, hint) => {
    const h = menu(status, blocked)
    const item = await screen.findByRole("menuitem", { name: "Download Word" })
    expect(item).toHaveAttribute("aria-disabled", "true")
    expect(item).toHaveAccessibleDescription(hint)
    expect(screen.getByText(hint)).toBeVisible()
    fireEvent.click(item)
    expect(h.downloadWord).not.toHaveBeenCalled()
  }
)

it("enables a saved download and reuses one in-flight action with progress and success", async () => {
  const h = menu()
  const item = await screen.findByRole("menuitem", { name: "Download Word" })
  expect(item).not.toHaveAttribute("aria-disabled", "true")
  expect(item).not.toHaveAttribute("aria-describedby")
  fireEvent.click(item)
  fireEvent.click(item)
  expect(h.downloadWord).toHaveBeenCalledOnce()
  expect(await screen.findByText("Preparing Word…")).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: "Document menu" }))
  expect(
    await screen.findByRole("menuitem", { name: "Preparing Word…" })
  ).toHaveAttribute("aria-disabled", "true")
  await act(async () => h.finish())
  expect(await screen.findByText("Word file downloaded.")).toBeVisible()
  expect(screen.queryByText("Preparing Word…")).not.toBeInTheDocument()
})

it.each([
  [
    new SavedRichWordChanged(),
    "Wait until your changes are saved and try again.",
  ],
  [new Error("500"), "Paper couldn't prepare the Word file. Try again."],
  [
    new TypeError("Failed to fetch"),
    "Paper couldn't prepare the Word file. Try again.",
  ],
  [
    new Error("Refused basis"),
    "Paper couldn't prepare the Word file. Try again.",
  ],
])("resolves the loading toast for %s", async (error, message) => {
  const h = menu()
  fireEvent.click(
    await screen.findByRole("menuitem", { name: "Download Word" })
  )
  expect(await screen.findByText("Preparing Word…")).toBeVisible()
  await act(async () => h.fail(error))
  expect(await screen.findByText(message)).toBeVisible()
  expect(screen.queryByText("Preparing Word…")).not.toBeInTheDocument()
  expect(h.downloadWord).toHaveBeenCalledOnce()
})
