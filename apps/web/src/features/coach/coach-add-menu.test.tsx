import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { SURFACE_PATHS } from "@/lib/product-paths.ts"
import { expectCoachIdle } from "@/test/coach-chat-helpers.ts"
import { getLastCoachRequest, scriptCoachStream } from "@/test/chat-api-mock.ts"
import {
  failPaperList,
  getMockPaperDocs,
  holdPaperList,
  resetPaperApiMock,
} from "@/test/paper-api-mock.ts"
import { renderApp } from "@/test/render-app.tsx"

const ACTION_COUNT = 4

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn())
  resetPaperApiMock()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

async function openAdd() {
  renderApp(SURFACE_PATHS.coach)
  await expectCoachIdle()
  fireEvent.click(screen.getByRole("button", { name: "Add" }))
  return screen.findByRole("menu")
}

describe("Coach Add menu", () => {
  it("lists the two most recently updated Paper documents, not sample names", async () => {
    const menu = await openAdd()
    const recent = [...getMockPaperDocs()]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 2)
    for (const doc of recent) {
      expect(
        await within(menu).findByRole("menuitem", { name: doc.name })
      ).toBeInTheDocument()
    }
    expect(within(menu).getAllByRole("menuitem")).toHaveLength(ACTION_COUNT + 2)
  })

  it("marks a selected Recent document and sends it as context", async () => {
    scriptCoachStream({ texts: ["Got it."] })
    const menu = await openAdd()
    const doc = [...getMockPaperDocs()].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt)
    )[0]!
    fireEvent.click(
      await within(menu).findByRole("menuitem", { name: doc.name })
    )
    fireEvent.click(screen.getByRole("button", { name: "Add" }))
    const reopened = await screen.findByRole("menu")
    expect(
      await within(reopened).findByRole("menuitem", {
        name: `${doc.name}, attached`,
      })
    ).toBeInTheDocument()
    fireEvent.keyDown(reopened, { key: "Escape" })

    fireEvent.change(screen.getByRole("textbox", { name: "Message Coach" }), {
      target: { value: "Review this" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Send" }))
    await waitFor(() => {
      expect(getLastCoachRequest()?.context).toEqual([
        { kind: "paper", id: doc.id },
      ])
    })
  })

  it("says Upload a file is unavailable and does nothing", async () => {
    const menu = await openAdd()
    const upload = within(menu).getByRole("menuitem", { name: /Upload a file/ })
    expect(upload).toHaveAttribute("aria-disabled", "true")
    expect(upload).toHaveTextContent("Coach cannot read uploaded files yet.")
  })

  it("shows a loading note then an error note for Recent", async () => {
    const release = holdPaperList()
    const menu = await openAdd()
    expect(await within(menu).findByText("Loading…")).toBeInTheDocument()
    release()
    await within(menu).findByRole("menuitem", {
      name: /PM track CV/,
    })
  })

  it("shows a note when Paper cannot load", async () => {
    failPaperList()
    const menu = await openAdd()
    expect(
      await within(menu).findByText("Could not load Paper.")
    ).toBeInTheDocument()
  })

  it("opens with the keyboard, selects with Enter and returns focus on Escape", async () => {
    const user = userEvent.setup()
    renderApp(SURFACE_PATHS.coach)
    await expectCoachIdle()
    const add = screen.getByRole("button", { name: "Add" })
    add.focus()
    await user.keyboard("{Enter}")
    const menu = await screen.findByRole("menu")
    const link = within(menu).getByRole("menuitem", {
      name: "Paste a job link",
    })
    for (let step = 0; step < 8 && document.activeElement !== link; step += 1)
      await user.keyboard("{ArrowDown}")
    expect(link).toHaveFocus()
    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull())
    expect(screen.getByRole("button", { name: "Add" })).toHaveFocus()

    await user.keyboard("{Enter}")
    await screen.findByRole("menu")
    const again = within(await screen.findByRole("menu")).getByRole(
      "menuitem",
      {
        name: "Paste a job link",
      }
    )
    for (let step = 0; step < 8 && document.activeElement !== again; step += 1)
      await user.keyboard("{ArrowDown}")
    await user.keyboard("{Enter}")
    expect(await screen.findByRole("dialog")).toHaveTextContent(
      "Paste a job link"
    )
  })
})
