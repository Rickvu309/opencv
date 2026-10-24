import { describe, expect, it } from "vitest"
import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { SURFACE_PATHS } from "@/features/app-shell/surfaces.ts"
import { getMockApplyCards } from "@/test/apply-api-mock.ts"
import {
  dragCardToStage,
  expectApplyLive,
  installApplyTestLifecycle,
  renderApply,
  stageColumn,
} from "@/test/apply-route-fixtures.ts"
import { renderApp } from "@/test/render-app.tsx"

installApplyTestLifecycle()

describe("Apply craft pass", () => {
  it("names the chrome Opportunity", async () => {
    renderApply()
    await expectApplyLive()

    expect(
      screen.getByRole("textbox", { name: "Search opportunities" })
    ).toHaveAttribute("placeholder", "Search opportunities or companies")
    expect(
      screen.getByRole("button", { name: "Add opportunity" })
    ).toBeInTheDocument()
    expect(screen.queryByText(/\bjobs?\b/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/\bjobs?\b/i)).not.toBeInTheDocument()
  })

  it("shows one Demo banner for the starter set", async () => {
    renderApply()
    await expectApplyLive()

    expect(screen.getAllByRole("status")).toHaveLength(1)
    expect(screen.getByRole("status")).toHaveTextContent(
      "The starter set shows how the board works"
    )
    expect(
      within(stageColumn("inbox")).queryByText("Demo")
    ).not.toBeInTheDocument()
  })

  it("asks before Clear demo deletes anything, and Cancel keeps every card", async () => {
    renderApply()
    await expectApplyLive()
    const before = getMockApplyCards().length

    fireEvent.click(screen.getByRole("button", { name: "Clear demo" }))

    const dialog = await screen.findByRole("dialog", {
      name: "Remove 4 sample opportunities?",
    })
    expect(getMockApplyCards()).toHaveLength(before)

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }))
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
    expect(getMockApplyCards()).toHaveLength(before)
    expect(screen.getByText("Associate PM intern")).toBeInTheDocument()
  })

  it("removes only cards still flagged demo, so a card the User moved survives", async () => {
    renderApply()
    await expectApplyLive()

    dragCardToStage("Business analyst intern", "sent")
    await waitFor(() => {
      expect(
        within(stageColumn("sent")).getByText("Business analyst intern")
      ).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: "Clear demo" }))
    const dialog = await screen.findByRole("dialog", {
      name: "Remove 3 sample opportunities?",
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }))

    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument()
    })
    expect(screen.queryByText("Associate PM intern")).not.toBeInTheDocument()
    expect(screen.getByText("Business analyst intern")).toBeInTheDocument()
    expect(screen.getByText("Product intern")).toBeInTheDocument()
    expect(getMockApplyCards().every((card) => !card.demo)).toBe(true)
  })

  it("says what each empty column holds once a card exists, without drop wells", async () => {
    renderApply()
    await expectApplyLive()

    expect(
      within(stageColumn("live")).getByText("Nothing in Live")
    ).toBeInTheDocument()
    expect(
      within(stageColumn("inbox")).queryByText(/Nothing in/)
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/Drop an? .* here/)).not.toBeInTheDocument()
    expect(document.querySelector("[data-slot='empty']")).toBeNull()
  })

  it("says no match, not nothing, in a column while a search hides its cards", async () => {
    renderApply()
    await expectApplyLive()

    fireEvent.change(
      screen.getByRole("textbox", { name: "Search opportunities" }),
      { target: { value: "regional" } }
    )

    expect(
      within(stageColumn("inbox")).getByText("No match in Inbox")
    ).toBeInTheDocument()
    expect(screen.queryByText(/^Nothing in /)).not.toBeInTheDocument()
    expect(
      within(stageColumn("prep")).getByText("Business analyst intern")
    ).toBeInTheDocument()
  })

  it("shows one empty state on an empty board and adds from it", async () => {
    getMockApplyCards().splice(0)
    renderApp(SURFACE_PATHS.apply)

    expect(await screen.findByText("No opportunities yet")).toBeInTheDocument()
    expect(document.querySelectorAll("[data-slot='empty']")).toHaveLength(1)
    expect(screen.queryByText(/Nothing in/)).not.toBeInTheDocument()
    for (const stage of ["Inbox", "Prep", "Sent", "Live", "Closed"]) {
      expect(screen.getByText(stage)).toBeInTheDocument()
    }

    const empty = document.querySelector("[data-slot='empty']") as HTMLElement
    fireEvent.click(
      within(empty).getByRole("button", { name: "Add opportunity" })
    )
    expect(
      await screen.findByRole("dialog", { name: "Add opportunity" })
    ).toBeInTheDocument()
  })

  it("leaves the empty state once the first card is added", async () => {
    getMockApplyCards().splice(0)
    renderApp(SURFACE_PATHS.apply)
    await screen.findByText("No opportunities yet")

    fireEvent.click(
      screen.getAllByRole("button", { name: "Add opportunity" })[0]!
    )
    const dialog = await screen.findByRole("dialog", {
      name: "Add opportunity",
    })
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Add opportunity" })
    )

    await waitFor(() => {
      expect(screen.queryByText("No opportunities yet")).not.toBeInTheDocument()
    })
    expect(screen.getAllByText(/^Nothing in /).length).toBeGreaterThan(0)
  })

  it("puts Scan posting first and the posting link and Copy link after it", async () => {
    const card = getMockApplyCards()[0]!
    card.jobUrl = "https://careers.example.com/role"
    renderApply()
    await expectApplyLive()

    fireEvent.click(screen.getByRole("button", { name: /Associate PM intern/ }))
    const panel = await screen.findByRole("complementary", {
      name: "Opportunity detail",
    })
    const source = within(panel).getByRole("region", { name: "Source" })
    const names = [...source.querySelectorAll<HTMLElement>("button, a")].map(
      (node) => node.textContent?.trim()
    )
    const scan = names.indexOf("Scan posting")
    expect(scan).toBeGreaterThanOrEqual(0)
    expect(names.indexOf("Open posting")).toBeGreaterThan(scan)
    expect(names.indexOf("Copy link")).toBeGreaterThan(scan)
  })

  it("labels the dated next event Track in the detail", async () => {
    renderApply()
    await expectApplyLive()

    fireEvent.click(screen.getByRole("button", { name: /Associate PM intern/ }))
    const panel = await screen.findByRole("complementary", {
      name: "Opportunity detail",
    })
    expect(within(panel).getByRole("region", { name: "Track" })).toBeTruthy()
    expect(
      within(panel).getByRole("combobox", { name: "Track" })
    ).toBeInTheDocument()
    expect(within(panel).queryByText("Next step")).not.toBeInTheDocument()
  })
})
