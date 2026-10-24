import { describe, expect, it } from "vitest"
import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { STARTER_CV_NAME } from "@workspace/domain"
import { expectPaperDrive } from "@/test/paper-drive.ts"
import { paperQueryKeys } from "@/features/paper/paper-api.ts"
import { failPaperList } from "@/test/paper-api-mock.ts"
import {
  installPaperTestLifecycle,
  openCoach,
  openDoc,
  renderPaper,
  seedStarterPaperDrive,
  stubDesktopViewport,
} from "@/test/paper-route-fixtures.ts"

installPaperTestLifecycle()

const RING = [
  "focus-visible:ring-3",
  "focus-visible:ring-ring/50",
  "focus-visible:border-ring",
]

describe("Paper list that fails to load", () => {
  it("says it could not load, never claims the list is empty, and Retry reloads", async () => {
    failPaperList()
    renderPaper()
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent(/couldn.t load/i)
    expect(screen.queryByText(/^No documents yet/)).not.toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()

    failPaperList(false)
    fireEvent.click(
      within(alert.parentElement!).getByRole("button", { name: "Retry" })
    )
    await expectPaperDrive()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
})

describe("Paper list that fails to refresh", () => {
  it("keeps the rows that already loaded and shows the error line with Retry", async () => {
    const { queryClient } = renderPaper()
    await expectPaperDrive()

    failPaperList()
    await queryClient
      .invalidateQueries({ queryKey: paperQueryKeys.all })
      .catch(() => undefined)
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn.t load/i)
    expect(screen.getByText("PM track CV")).toBeInTheDocument()
    expect(screen.getByRole("table")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument()
  })
})

describe("Paper editor header focus", () => {
  it("gives every header control the kit focus ring", async () => {
    seedStarterPaperDrive()
    renderPaper()
    const editor = await openDoc(STARTER_CV_NAME)
    const header = editor.querySelector("header") as HTMLElement
    const controls = [
      within(header).getByRole("textbox", { name: "Name" }),
      within(header).getByRole("button", { name: "Paper list" }),
      within(header).getByRole("button", { name: "Make mine" }),
      within(header).getByRole("button", { name: "More" }),
      within(header).getByRole("button", { name: "Status" }),
      within(header).getByRole("button", { name: "Share" }),
      within(header).getByRole("button", { name: "Saved" }),
    ]
    for (const control of controls) {
      for (const cls of RING) expect(control).toHaveClass(cls)
      expect(control).not.toHaveClass("focus-visible:ring-0")
    }
  })
})

describe("Paper Coach on a phone", () => {
  it("replaces the document while open so it never covers CV text, and Close brings it back", async () => {
    stubDesktopViewport(false)
    renderPaper()
    await expectPaperDrive()
    const editor = await openDoc("PM track CV")
    const column = editor.querySelector("[data-paper-editor]") as HTMLElement
    expect(column).toBeVisible()

    const dialog = await openCoach()
    expect(column).not.toBeVisible()
    expect(dialog).toBeVisible()
    expect(dialog).toHaveFocus()
    expect(
      within(dialog).queryByRole("button", { name: "Minimize" })
    ).toBeNull()

    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }))
    expect(screen.queryByRole("dialog", { name: "Coach" })).toBeNull()
    expect(column).toBeVisible()
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Coach" })).toHaveFocus()
    })
  })
})
