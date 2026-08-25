import { createElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"

import { DEFAULT_DEV_PROFILE_NAME } from "@/features/app-shell/dev-profile.ts"
import { SURFACE_PATHS } from "@/features/app-shell/surfaces.ts"
import { STUB_PAPER_COACH_REPLY } from "@/features/paper/paper-ai-chat.tsx"
import { createAppRouter } from "@/router.tsx"
import { expectPaperDrive } from "@/test/paper-drive.ts"

function renderPaper() {
  const router = createAppRouter({
    history: createMemoryHistory({ initialEntries: [SURFACE_PATHS.paper] }),
  })

  return {
    router,
    ...render(createElement(RouterProvider, { router })),
  }
}

async function openDoc(name: string) {
  fireEvent.click(await screen.findByText(name))
  expect(
    await screen.findByRole("region", { name: `Editing ${name}` })
  ).toBeInTheDocument()
}

beforeEach(() => {
  sessionStorage.clear()
  vi.stubGlobal("scrollTo", vi.fn())
})

afterEach(() => {
  cleanup()
  sessionStorage.clear()
  vi.unstubAllGlobals()
})

describe("Paper drive", () => {
  it("lists documents with status and filters by search", async () => {
    renderPaper()
    await expectPaperDrive()

    expect(screen.getByText("CVs")).toBeInTheDocument()
    expect(screen.getByText("Letters")).toBeInTheDocument()
    expect(screen.getByText("Proof")).toBeInTheDocument()
    expect(screen.getAllByText("Draft").length).toBeGreaterThan(0)
    expect(screen.getByText("Ready")).toBeInTheDocument()
    expect(screen.queryByText(/Eric Nguyen/i)).not.toBeInTheDocument()

    const search = screen.getByRole("textbox", { name: "Search documents" })
    fireEvent.change(search, { target: { value: "cover" } })

    expect(screen.getByText("Cover: Associate PM intern")).toBeInTheDocument()
    expect(screen.getByText("Cover: Product intern")).toBeInTheDocument()
    expect(screen.queryByText("PM track CV")).not.toBeInTheDocument()
    expect(
      screen.queryByText("Checkout card resize study")
    ).not.toBeInTheDocument()

    fireEvent.change(search, { target: { value: "zzzz-no-doc" } })
    expect(
      screen.queryByText("Cover: Associate PM intern")
    ).not.toBeInTheDocument()
  })

  it("opens a document and returns to the drive", async () => {
    renderPaper()
    await expectPaperDrive()

    await openDoc("PM track CV")
    expect(
      screen.getByRole("button", { name: /all documents/i })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("region", { name: "Paper" })
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /all documents/i }))
    await expectPaperDrive()
  })
})

describe("Paper editors", () => {
  it("opens a CV on A4 and switches among the five templates", async () => {
    renderPaper()
    await expectPaperDrive()
    await openDoc("PM track CV")

    expect(screen.getByText("Profile")).toBeInTheDocument()
    expect(
      screen.getAllByText(DEFAULT_DEV_PROFILE_NAME).length
    ).toBeGreaterThan(0)
    expect(screen.getByRole("textbox", { name: "Summary" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /Product & design/ }))
    const templates = await screen.findByRole("listbox", {
      name: "CV templates",
    })
    expect(
      within(templates).getByRole("option", { name: /Classic internship/ })
    ).toBeInTheDocument()
    expect(
      within(templates).getByRole("option", { name: /Product & design/ })
    ).toBeInTheDocument()
    expect(
      within(templates).getByRole("option", { name: /Project-led/ })
    ).toBeInTheDocument()
    expect(
      within(templates).getByRole("option", { name: /Campus & projects/ })
    ).toBeInTheDocument()
    expect(
      within(templates).getByRole("option", { name: /With photo/ })
    ).toBeInTheDocument()

    fireEvent.click(
      within(templates).getByRole("option", { name: /Classic internship/ })
    )
    expect(await screen.findByText("Summary")).toBeInTheDocument()
    expect(screen.queryByText("Profile")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /Classic internship/ }))
    fireEvent.click(
      within(
        await screen.findByRole("listbox", { name: "CV templates" })
      ).getByRole("option", { name: /With photo/ })
    )
    expect(
      await screen.findByRole("button", { name: /profile photo/i })
    ).toBeInTheDocument()
  })

  it("opens and edits a Letter", async () => {
    renderPaper()
    await expectPaperDrive()
    await openDoc("Cover: Associate PM intern")

    const editor = screen.getByRole("textbox", { name: "Document content" })
    expect(editor).toHaveAttribute("contenteditable", "true")
    expect(editor).toHaveTextContent(/associate product manager intern/i)
    expect(editor).toHaveTextContent(new RegExp(`Best,\\s*Alex`))
    expect(editor).not.toHaveTextContent(/Eric/)

    fireEvent.input(editor, {
      target: { innerHTML: "<p>Edited letter draft</p>" },
    })
    expect(editor).toHaveTextContent("Edited letter draft")
  })

  it("opens and edits a Proof, including the timeline view", async () => {
    renderPaper()
    await expectPaperDrive()
    await openDoc("Checkout card resize study")

    const title = screen.getByRole("textbox", { name: "Proof title" })
    expect(title).toHaveValue("Product card resize study")
    expect(screen.getByText("Context")).toBeInTheDocument()
    expect(screen.getByText("What I did")).toBeInTheDocument()
    expect(screen.getByText("Outcome")).toBeInTheDocument()

    fireEvent.change(title, { target: { value: "Checkout study rewrite" } })
    expect(title).toHaveValue("Checkout study rewrite")

    fireEvent.click(screen.getByRole("button", { name: "Timeline" }))
    expect(screen.getByText("Timeline preview")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Expand all" })
    ).toBeInTheDocument()
  })

  it("keeps the AI panel as an honest stub Coach", async () => {
    renderPaper()
    await expectPaperDrive()
    await openDoc("PM track CV")

    fireEvent.click(screen.getByRole("button", { name: /AI assist/ }))
    const panel = await screen.findByRole("dialog", { name: "AI assist" })
    expect(panel).toHaveTextContent(/can't edit it yet/i)
    expect(panel).toHaveTextContent(/haven't run any Commands/i)

    const composer = within(panel).getByRole("textbox", {
      name: "Message AI assist",
    })
    fireEvent.change(composer, { target: { value: "Rewrite my summary" } })
    fireEvent.click(within(panel).getByRole("button", { name: "Send" }))

    expect(await within(panel).findByText("Working…")).toBeInTheDocument()
    expect(
      await within(panel).findByText(
        STUB_PAPER_COACH_REPLY,
        {},
        { timeout: 2000 }
      )
    ).toBeInTheDocument()
    expect(panel).not.toHaveTextContent(
      /I (have|'ve|just) (edited|updated|rewrote)/i
    )
  })
})
