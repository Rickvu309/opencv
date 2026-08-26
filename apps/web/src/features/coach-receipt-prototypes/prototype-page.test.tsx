import { cleanup, fireEvent, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { renderApp } from "@/test/render-app.tsx"

afterEach(() => {
  cleanup()
})

async function openPrototype() {
  renderApp("/prototype/coach-receipts")
  expect(
    await screen.findByRole("heading", { name: "Per-command Coach receipts" })
  ).toBeInTheDocument()
}

describe("Coach receipt prototypes", () => {
  it("renders the three richer receipts in a Thread, next to the live generic line", async () => {
    await openPrototype()

    expect(
      screen.getByText(/production receipt code is not wired/i)
    ).toBeInTheDocument()

    expect(
      screen.getByText("Updated CV Sample internship CV")
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "Moved Associate PM intern at Local startup from Inbox to Prep"
      )
    ).toBeInTheDocument()
    expect(screen.getByText("Created CV Untitled CV")).toBeInTheDocument()

    expect(
      screen.getByText(
        "Ran paper.updateContent — Updated content of Sample internship CV"
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "Ran apply.moveCard — Moved Associate PM intern at Local startup to Prep"
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText("Ran paper.createDoc — Created CV Untitled CV")
    ).toBeInTheDocument()
  })

  it("lets a reviewer switch Paper kind and outcome on updateContent", async () => {
    await openPrototype()
    fireEvent.click(screen.getByRole("tab", { name: "Update content" }))

    const pane = screen.getByRole("region", {
      name: "paper.updateContent prototype",
    })
    fireEvent.click(within(pane).getByRole("button", { name: "Letter" }))
    expect(
      within(pane).getByText("Updated Letter Associate PM intern")
    ).toBeInTheDocument()

    fireEvent.click(within(pane).getByRole("button", { name: "Failure" }))
    expect(
      within(pane).getByText(
        "Ran paper.updateContent — Paper document not found"
      )
    ).toBeInTheDocument()
    expect(within(pane).queryByText("Opening")).not.toBeInTheDocument()
  })

  it("replays a move and names from-Stage and to-Stage", async () => {
    await openPrototype()
    fireEvent.click(screen.getByRole("tab", { name: "Move card" }))

    const pane = screen.getByRole("region", {
      name: "apply.moveCard prototype",
    })
    fireEvent.click(
      within(within(pane).getByRole("group", { name: "To" })).getByRole(
        "button",
        { name: "Sent" }
      )
    )
    expect(
      within(pane).getByText(
        "Moved Associate PM intern at Local startup from Inbox to Sent"
      )
    ).toBeInTheDocument()
    expect(
      within(pane).getByText(
        "Ran apply.moveCard — Moved Associate PM intern at Local startup to Sent"
      )
    ).toBeInTheDocument()

    fireEvent.click(within(pane).getByRole("button", { name: "Replay move" }))
    expect(
      within(pane).getByLabelText(/Board Stages, card now in/i)
    ).toBeInTheDocument()
  })

  it("shows a first-page skim for createDoc and a prototype-only open note", async () => {
    await openPrototype()
    fireEvent.click(screen.getByRole("tab", { name: "Create doc" }))

    const pane = screen.getByRole("region", {
      name: "paper.createDoc prototype",
    })
    fireEvent.click(within(pane).getByRole("button", { name: "Proof" }))
    expect(
      within(pane).getByText("Created Proof Untitled Proof")
    ).toBeInTheDocument()
    expect(
      within(pane).getByLabelText("Proof first-page preview")
    ).toBeInTheDocument()

    fireEvent.click(within(pane).getByRole("button", { name: "Open in Paper" }))
    expect(
      screen.getByText(/does not open the live Paper surface/i)
    ).toBeInTheDocument()
  })

  it("keeps graduation notes on the preview", async () => {
    await openPrototype()
    fireEvent.click(screen.getByRole("tab", { name: "Notes" }))
    expect(
      screen.getByText(/Third Command: paper.createDoc/)
    ).toBeInTheDocument()
    expect(
      screen.getByText("What is better than the generic line")
    ).toBeInTheDocument()
    expect(screen.getByText("What is noise")).toBeInTheDocument()
  })
})
