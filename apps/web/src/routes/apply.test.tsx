import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"

import { APPLY_OPEN_GUIDE } from "@/features/apply/apply-search.ts"
import { APPLY_DRAG_TYPE, localIsoDate } from "@/features/apply/apply-types.ts"
import { SURFACE_COPY, SURFACE_PATHS } from "@/features/app-shell/surfaces.ts"
import { sampleApplyCards } from "@/test/apply-fixtures.ts"
import { renderApp } from "@/test/render-app.tsx"

const SAMPLE_CARDS = sampleApplyCards()
const ANALYST_ID = SAMPLE_CARDS.find(
  (card) => card.title === "Business analyst intern"
)!.id

function renderApply() {
  return renderApp(SURFACE_PATHS.apply)
}

async function expectApplyLive() {
  expect(
    await screen.findByRole("heading", { level: 1, name: "Apply" })
  ).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Board" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Calendar" })).toBeInTheDocument()
  expect(await screen.findByText("Associate PM intern")).toBeInTheDocument()
  expect(stageColumn("inbox")).toBeTruthy()
  expect(stageColumn("prep")).toBeTruthy()
  expect(stageColumn("sent")).toBeTruthy()
  expect(stageColumn("live")).toBeTruthy()
  expect(stageColumn("closed")).toBeTruthy()
  expect(screen.queryByText(SURFACE_COPY.apply.body)).not.toBeInTheDocument()
}

function stageColumn(id: string) {
  const column = document.querySelector(`[data-stage="${id}"]`)
  expect(column).toBeTruthy()
  return column as HTMLElement
}

function createDataTransfer() {
  const store: Record<string, string> = {}
  return {
    dropEffect: "none",
    effectAllowed: "all",
    files: [] as File[],
    items: [] as unknown[],
    types: [] as string[],
    setData(type: string, value: string) {
      store[type] = value
      if (!this.types.includes(type)) this.types.push(type)
    },
    getData(type: string) {
      return store[type] ?? ""
    },
    clearData() {
      for (const key of Object.keys(store)) delete store[key]
      this.types.length = 0
    },
    setDragImage() {},
  }
}

function dragCardToStage(cardName: string, stageId: string) {
  const card = screen.getByRole("button", { name: new RegExp(cardName) })
  const dataTransfer = createDataTransfer()
  fireEvent.dragStart(card, { dataTransfer })
  fireEvent.drag(card, { dataTransfer })
  const column = stageColumn(stageId)
  fireEvent.dragOver(column, { dataTransfer })
  fireEvent.drop(column, { dataTransfer })
  fireEvent.dragEnd(card, { dataTransfer })
  return dataTransfer
}

function dragCardOntoCard(sourceName: string, targetName: string) {
  const source = screen.getByRole("button", { name: new RegExp(sourceName) })
  const target = screen.getByRole("button", { name: new RegExp(targetName) })
  const dataTransfer = createDataTransfer()
  fireEvent.dragStart(source, { dataTransfer })
  fireEvent.drag(source, { dataTransfer })
  fireEvent.dragOver(target, { dataTransfer })
  fireEvent.drop(target, { dataTransfer })
  fireEvent.dragEnd(source, { dataTransfer })
}

function expectNoVisibleFitScore() {
  expect(screen.queryByText(/Fit score/i)).not.toBeInTheDocument()
  expect(screen.queryByText("/ 100")).not.toBeInTheDocument()
  expect(screen.queryByLabelText(/fit/i)).not.toBeInTheDocument()
  expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument()
  expect(document.body.textContent).not.toMatch(/\b(48|61|68|74|79)\b/)
}

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn())
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("Apply workspace", () => {
  it("renders Stages and server cards instead of the stub", async () => {
    renderApply()
    await expectApplyLive()
    expect(
      within(stageColumn("inbox")).getByText("Associate PM intern")
    ).toBeInTheDocument()
    expect(
      within(stageColumn("inbox")).getByText("Product intern")
    ).toBeInTheDocument()
    expect(
      within(stageColumn("prep")).getByText("Business analyst intern")
    ).toBeInTheDocument()
    expect(
      within(stageColumn("sent")).getByText("Product analyst intern")
    ).toBeInTheDocument()
    expect(
      within(stageColumn("closed")).getByText("UX research intern")
    ).toBeInTheDocument()
    expect(
      within(stageColumn("live")).getByText("Drop a job here")
    ).toBeInTheDocument()
    expect(screen.queryByText(/Eric Nguyen/i)).not.toBeInTheDocument()
    expectNoVisibleFitScore()
  })

  it("drags a card to another Stage and keeps the move", async () => {
    renderApply()
    await expectApplyLive()

    const dataTransfer = dragCardToStage("Business analyst intern", "sent")
    expect(dataTransfer.getData(APPLY_DRAG_TYPE)).toBe(ANALYST_ID)

    await waitFor(() => {
      expect(
        within(stageColumn("sent")).getByText("Business analyst intern")
      ).toBeInTheDocument()
    })
    expect(
      within(stageColumn("prep")).queryByText("Business analyst intern")
    ).not.toBeInTheDocument()
    expect(
      within(stageColumn("sent")).getByText("Product analyst intern")
    ).toBeInTheDocument()
  })

  it("reorders a card within a Stage", async () => {
    renderApply()
    await expectApplyLive()

    dragCardOntoCard("Product intern", "Associate PM intern")

    await waitFor(() => {
      const titles = [
        ...stageColumn("inbox").querySelectorAll("[data-card-id]"),
      ].map((node) => node.getAttribute("aria-label"))
      expect(titles[0]).toMatch(/Product intern/)
      expect(titles[1]).toMatch(/Associate PM intern/)
    })
  })

  it("does not auto-open a card without the guided deep-link", async () => {
    renderApply()
    await expectApplyLive()
    expect(
      screen.queryByRole("complementary", { name: "Job detail" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Move to Prep" })
    ).not.toBeInTheDocument()
    expect(
      within(stageColumn("inbox")).getByText("Associate PM intern")
    ).toBeInTheDocument()
    expect(
      within(stageColumn("inbox")).getByText("Product intern")
    ).toBeInTheDocument()
  })

  it("opens one seeded card from the Home guided deep-link without emptying the board", async () => {
    renderApp(`${SURFACE_PATHS.apply}?open=${APPLY_OPEN_GUIDE}`)
    await expectApplyLive()

    const panel = await screen.findByRole("complementary", {
      name: "Job detail",
    })
    expect(
      within(panel).getByDisplayValue("Associate PM intern")
    ).toBeInTheDocument()
    expect(within(panel).getByDisplayValue("Local startup")).toBeInTheDocument()
    expect(
      within(panel).getByRole("button", { name: "Move to Prep" })
    ).toBeInTheDocument()
    expect(
      within(panel).getByRole("combobox", { name: "Next step" })
    ).toHaveTextContent("Follow-up")

    expect(
      within(stageColumn("inbox")).getByText("Product intern")
    ).toBeInTheDocument()
    expect(
      within(stageColumn("prep")).getByText("Business analyst intern")
    ).toBeInTheDocument()
    expect(
      within(stageColumn("sent")).getByText("Product analyst intern")
    ).toBeInTheDocument()
    expect(
      within(stageColumn("closed")).getByText("UX research intern")
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /skip tour|continue tour/i })
    ).not.toBeInTheDocument()
  })

  it("moves the guided inbox card to Prep and keeps the other cards", async () => {
    renderApp(`${SURFACE_PATHS.apply}?open=${APPLY_OPEN_GUIDE}`)
    await expectApplyLive()

    const panel = await screen.findByRole("complementary", {
      name: "Job detail",
    })
    fireEvent.click(within(panel).getByRole("button", { name: "Move to Prep" }))

    await waitFor(() => {
      expect(
        within(stageColumn("prep")).getByText("Associate PM intern")
      ).toBeInTheDocument()
    })
    expect(
      within(stageColumn("inbox")).queryByText("Associate PM intern")
    ).not.toBeInTheDocument()
    expect(
      within(stageColumn("inbox")).getByText("Product intern")
    ).toBeInTheDocument()
    expect(
      within(stageColumn("prep")).getByText("Business analyst intern")
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Move to Prep" })
    ).not.toBeInTheDocument()
    expect(
      within(
        await screen.findByRole("complementary", { name: "Job detail" })
      ).getByRole("combobox", { name: "Next step" })
    ).toHaveTextContent("Follow-up")
  })

  it("opens job detail from a card without showing Fit", async () => {
    renderApply()
    await expectApplyLive()

    fireEvent.click(screen.getByRole("button", { name: /Associate PM intern/ }))

    const panel = await screen.findByRole("complementary", {
      name: "Job detail",
    })
    expect(
      within(panel).getByDisplayValue("Associate PM intern")
    ).toBeInTheDocument()
    expect(within(panel).getByDisplayValue("Local startup")).toBeInTheDocument()
    expect(within(panel).getByText("Notes")).toBeInTheDocument()
    expect(
      within(panel).getByDisplayValue(
        "JD wants discovery notes + 1 shipped experiment."
      )
    ).toBeInTheDocument()
    expect(within(panel).getByRole("region", { name: "Source" })).toBeTruthy()
    expect(
      within(panel).getByRole("region", { name: "Next step" })
    ).toBeTruthy()
    expect(
      within(panel).getByRole("textbox", { name: "Source" })
    ).toBeInTheDocument()
    expect(
      within(panel).getByRole("combobox", { name: "Next step" })
    ).toBeInTheDocument()
    expect(within(panel).getByLabelText("Date")).toHaveValue("2026-08-26")
    expect(within(panel).queryByText("Event type")).not.toBeInTheDocument()
    expect(within(panel).queryByText("Track date")).not.toBeInTheDocument()
    expect(within(panel).queryByText("Job posting URL")).not.toBeInTheDocument()
    expectNoVisibleFitScore()
    expect(screen.queryByText(/Eric Nguyen/i)).not.toBeInTheDocument()
    expect(
      within(panel).queryByRole("button", { name: "Open job posting" })
    ).not.toBeInTheDocument()
    expect(within(panel).queryByDisplayValue(/example\.com/i)).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Close panel" }))
    expect(
      screen.queryByRole("complementary", { name: "Job detail" })
    ).not.toBeInTheDocument()
  })

  it("renders the calendar of Tracks", async () => {
    const now = new Date(2026, 7, 26, 12)
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(now)

    renderApply()
    await expectApplyLive()

    fireEvent.click(screen.getByRole("button", { name: "Calendar" }))

    const monthTitle = `${now.toLocaleString("en-US", { month: "long" })} ${now.getFullYear()}`
    expect(screen.getByText(monthTitle)).toBeInTheDocument()
    expect(screen.getByText(/jobs with a track date/)).toBeInTheDocument()
    expect(screen.getByText("Sun")).toBeInTheDocument()

    const todayIso = localIsoDate(now)
    const todayCell = document.querySelector(`[data-track-date="${todayIso}"]`)
    expect(todayCell).toHaveAttribute("data-today", "true")
    expect(
      within(todayCell as HTMLElement).getByRole("button", {
        name: String(now.getDate()),
      })
    ).toHaveAttribute("aria-current", "date")

    expect(
      screen.getByRole("button", { name: "Associate PM intern" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Product intern" })
    ).toBeInTheDocument()
    expectNoVisibleFitScore()

    fireEvent.click(screen.getByRole("button", { name: "Associate PM intern" }))
    expect(
      await screen.findByRole("complementary", { name: "Job detail" })
    ).toBeInTheDocument()
    expectNoVisibleFitScore()
  })

  it("filters cards by company and keeps the Apply badge in the sidebar", async () => {
    renderApply()
    await expectApplyLive()

    const apply = screen.getByRole("link", { name: "Apply" })
    expect(apply).toHaveAttribute("aria-current", "page")
    expect(apply.querySelector("[data-slot='badge']")).not.toBeNull()

    fireEvent.change(screen.getByRole("textbox", { name: "Search jobs" }), {
      target: { value: "fintech" },
    })

    expect(screen.getByText("Product intern")).toBeInTheDocument()
    expect(screen.queryByText("Associate PM intern")).not.toBeInTheDocument()
    expect(
      screen.queryByText("Business analyst intern")
    ).not.toBeInTheDocument()
  })

  it("marks unfinished chrome as coming soon and enables Add job", async () => {
    renderApply()
    await expectApplyLive()

    const filter = screen.getByRole("button", { name: /filter/i })
    const add = screen.getByRole("button", { name: /add job/i })
    expect(filter).toBeDisabled()
    expect(add).toBeEnabled()
    expect(filter).toHaveTextContent("Coming soon")
    expect(add).not.toHaveTextContent("Coming soon")
    expect(
      screen.getByRole("button", { name: "Inbox column menu — coming soon" })
    ).toBeDisabled()

    fireEvent.click(screen.getByRole("button", { name: /Associate PM intern/ }))
    expect(
      await screen.findByRole("button", { name: "Link Paper docs" })
    ).toBeEnabled()
  })

  it("confirms before deleting a job and does not run on dismiss", async () => {
    renderApply()
    await expectApplyLive()

    fireEvent.click(screen.getByRole("button", { name: /Associate PM intern/ }))
    const panel = await screen.findByRole("complementary", {
      name: "Job detail",
    })
    fireEvent.click(within(panel).getByRole("button", { name: "Delete job" }))

    const confirm = await screen.findByRole("dialog", { name: "Delete job" })
    expect(confirm).toHaveTextContent("Associate PM intern at Local startup")
    fireEvent.click(within(confirm).getByRole("button", { name: "Cancel" }))
    expect(
      screen.queryByRole("dialog", { name: "Delete job" })
    ).not.toBeInTheDocument()
    expect(screen.getByText("Associate PM intern")).toBeInTheDocument()
    expect(
      screen.getByRole("complementary", { name: "Job detail" })
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Delete job" }))
    const confirmAgain = await screen.findByRole("dialog", {
      name: "Delete job",
    })
    fireEvent.click(
      within(confirmAgain).getByRole("button", { name: "Delete" })
    )

    await waitFor(() => {
      expect(screen.queryByText("Associate PM intern")).not.toBeInTheDocument()
    })
    expect(
      screen.queryByRole("complementary", { name: "Job detail" })
    ).not.toBeInTheDocument()
    expect(screen.getByText("Product intern")).toBeInTheDocument()
  })

  async function addJobFromDialog(jobUrl?: string) {
    fireEvent.click(screen.getByRole("button", { name: "Add job" }))
    const dialog = await screen.findByRole("dialog", { name: "Add job" })
    if (jobUrl !== undefined) {
      fireEvent.change(within(dialog).getByLabelText("Job posting URL"), {
        target: { value: jobUrl },
      })
    }
    fireEvent.click(within(dialog).getByRole("button", { name: "Add job" }))
    return dialog
  }

  it("creates a job and links a Paper doc from job detail", async () => {
    renderApply()
    await expectApplyLive()

    await addJobFromDialog()
    const panel = await screen.findByRole("complementary", {
      name: "Job detail",
    })
    expect(within(panel).getByDisplayValue("Untitled role")).toBeInTheDocument()
    expect(
      within(panel).queryByRole("button", { name: "Open job posting" })
    ).not.toBeInTheDocument()

    fireEvent.click(
      within(panel).getByRole("button", { name: "Link Paper docs" })
    )
    const menu = await screen.findByRole("menu", { name: "Link Paper docs" })
    fireEvent.click(
      within(menu).getByRole("menuitemcheckbox", { name: /PM track CV/ })
    )
    expect(
      await within(menu).findByRole("menuitemcheckbox", { name: /PM track CV/ })
    ).toHaveAttribute("aria-checked", "true")
  })

  it("adds a job with a posting URL and opens it from the drawer", async () => {
    const open = vi.fn(() => ({ closed: false }))
    vi.stubGlobal("open", open)

    renderApply()
    await expectApplyLive()

    await addJobFromDialog("careers.example.com/pm-intern")
    const panel = await screen.findByRole("complementary", {
      name: "Job detail",
    })
    expect(within(panel).getByDisplayValue("Untitled role")).toBeInTheDocument()
    expect(
      within(panel).getByDisplayValue("https://careers.example.com/pm-intern")
    ).toBeInTheDocument()

    fireEvent.click(
      within(panel).getByRole("button", { name: "Open job posting" })
    )
    expect(open).toHaveBeenCalledWith(
      "https://careers.example.com/pm-intern",
      "_blank",
      "noopener,noreferrer"
    )
  })

  it("keeps Add job open when the posting URL is not a web URL", async () => {
    renderApply()
    await expectApplyLive()

    await addJobFromDialog("javascript:alert(1)")
    const dialog = await screen.findByRole("dialog", { name: "Add job" })
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "That posting link isn't a valid web URL."
    )
    expect(
      screen.queryByRole("complementary", { name: "Job detail" })
    ).not.toBeInTheDocument()
    expect(screen.queryByText("Untitled role")).not.toBeInTheDocument()
  })

  it("keeps an empty Source calm and saves source plus next step", async () => {
    renderApply()
    await expectApplyLive()

    await addJobFromDialog()
    const panel = await screen.findByRole("complementary", {
      name: "Job detail",
    })
    const source = within(panel).getByRole("region", { name: "Source" })
    const nextStep = within(panel).getByRole("region", { name: "Next step" })

    const sourceField = within(source).getByRole("textbox", { name: "Source" })
    const nextStepKind = within(nextStep).getByRole("combobox", {
      name: "Next step",
    })
    expect(sourceField).toHaveValue("")
    expect(
      within(source).getByPlaceholderText("Paste a posting link")
    ).toBeInTheDocument()
    expect(
      within(source).queryByText(/stay organized/i)
    ).not.toBeInTheDocument()
    expect(within(source).queryByText(/never miss/i)).not.toBeInTheDocument()
    expect(within(source).queryByText(/add a source/i)).not.toBeInTheDocument()
    expect(source.querySelector("[data-slot='empty']")).toBeNull()
    expect(nextStepKind).toHaveTextContent("Follow-up")
    expect(within(nextStep).getByLabelText("Date")).toBeInTheDocument()

    fireEvent.change(sourceField, {
      target: { value: "careers.example.com/cafe-role" },
    })
    fireEvent.blur(sourceField)
    await waitFor(() => {
      expect(
        within(panel).getByRole("textbox", { name: "Source" })
      ).toHaveValue("https://careers.example.com/cafe-role")
    })
    expect(within(panel).getByText("careers.example.com")).toBeInTheDocument()
    expect(
      within(panel).getByRole("button", { name: "Open job posting" })
    ).toBeInTheDocument()

    fireEvent.change(within(panel).getByLabelText("Date"), {
      target: { value: "2026-09-20" },
    })
    await waitFor(() => {
      expect(within(panel).getByLabelText("Date")).toHaveValue("2026-09-20")
    })

    fireEvent.click(within(panel).getByRole("button", { name: "Close panel" }))
    fireEvent.click(
      screen.getByRole("button", { name: /Untitled role at Company/ })
    )
    const reopened = await screen.findByRole("complementary", {
      name: "Job detail",
    })
    expect(
      within(reopened).getByRole("textbox", { name: "Source" })
    ).toHaveValue("https://careers.example.com/cafe-role")
    expect(within(reopened).getByLabelText("Date")).toHaveValue("2026-09-20")
    expect(
      within(reopened).getByRole("combobox", { name: "Next step" })
    ).toHaveTextContent("Follow-up")
  })

  it("honest-fails when the browser blocks opening the posting", async () => {
    vi.stubGlobal(
      "open",
      vi.fn(() => null)
    )

    renderApply()
    await expectApplyLive()

    await addJobFromDialog("linkedin.com/jobs/view/123")
    const panel = await screen.findByRole("complementary", {
      name: "Job detail",
    })
    fireEvent.click(
      within(panel).getByRole("button", { name: "Open job posting" })
    )
    expect(within(panel).getByRole("alert")).toHaveTextContent(
      "The browser blocked opening this posting."
    )
  })

  it("does not open leftover seeded jobs.example.com", async () => {
    const open = vi.fn(() => ({ closed: false }))
    vi.stubGlobal("open", open)

    renderApply()
    await expectApplyLive()

    fireEvent.click(screen.getByRole("button", { name: /Associate PM intern/ }))
    const panel = await screen.findByRole("complementary", {
      name: "Job detail",
    })
    expect(
      within(panel).queryByRole("button", { name: "Open job posting" })
    ).not.toBeInTheDocument()
    expect(within(panel).queryByDisplayValue(/jobs\.example\.com/i)).toBeNull()
    expect(open).not.toHaveBeenCalled()
  })

  it("scans pasted JD and opens an editable drawer", async () => {
    renderApply()
    await expectApplyLive()

    fireEvent.click(screen.getByRole("button", { name: "Add job" }))
    const dialog = await screen.findByRole("dialog", { name: "Add job" })
    fireEvent.change(within(dialog).getByLabelText("Job text"), {
      target: {
        value:
          "Local startup is hiring an Associate PM intern in Hanoi. Apply by 12 September.",
      },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Scan" }))
    expect(
      await within(dialog).findByText(
        "Filled Associate PM intern at Local startup."
      )
    ).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole("button", { name: "Add job" }))
    const panel = await screen.findByRole("complementary", {
      name: "Job detail",
    })
    expect(
      within(panel).getByDisplayValue("Associate PM intern")
    ).toBeInTheDocument()
    expect(within(panel).getByDisplayValue("Local startup")).toBeInTheDocument()
    expect(within(panel).getByDisplayValue("Hanoi")).toBeInTheDocument()

    fireEvent.change(within(panel).getByLabelText("Job title"), {
      target: { value: "Associate PM intern (edited)" },
    })
    fireEvent.blur(within(panel).getByLabelText("Job title"))
    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: /Associate PM intern \(edited\) at Local startup/,
        })
      ).toBeInTheDocument()
    })
  })

  it("scans a posting URL and autofills the drawer", async () => {
    renderApply()
    await expectApplyLive()

    fireEvent.click(screen.getByRole("button", { name: "Add job" }))
    const dialog = await screen.findByRole("dialog", { name: "Add job" })
    fireEvent.change(within(dialog).getByLabelText("Job posting URL"), {
      target: { value: "careers.example.com/pm-intern" },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Scan" }))
    expect(
      await within(dialog).findByText("Filled PM intern at Example.")
    ).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole("button", { name: "Add job" }))
    const panel = await screen.findByRole("complementary", {
      name: "Job detail",
    })
    expect(within(panel).getByDisplayValue("PM intern")).toBeInTheDocument()
    expect(within(panel).getByDisplayValue("Example")).toBeInTheDocument()
    expect(
      within(panel).getByDisplayValue("https://careers.example.com/pm-intern")
    ).toBeInTheDocument()
    expect(
      within(panel).getByRole("button", { name: "Scan posting" })
    ).toBeEnabled()
  })

  it("scans the same labeled JD twice without a false Couldn't find", async () => {
    renderApply()
    await expectApplyLive()

    fireEvent.click(screen.getByRole("button", { name: "Add job" }))
    const dialog = await screen.findByRole("dialog", { name: "Add job" })
    const jd = within(dialog).getByLabelText("Job text")
    const cafeJd = [
      "Job Title: Café Barista Lead",
      "Company: Highlands Coffee",
      "Location: District 1, Ho Chi Minh City",
      "We need a café lead who owns the morning rush and trains new baristas.",
    ].join("\n")

    fireEvent.change(jd, { target: { value: cafeJd } })
    fireEvent.click(within(dialog).getByRole("button", { name: "Scan" }))
    expect(
      await within(dialog).findByText(
        "Filled Café Barista Lead at Highlands Coffee."
      )
    ).toBeInTheDocument()

    fireEvent.change(jd, { target: { value: `${cafeJd} ` } })
    fireEvent.change(jd, { target: { value: cafeJd } })
    fireEvent.click(within(dialog).getByRole("button", { name: "Scan" }))
    expect(
      await within(dialog).findByText(
        "Filled Café Barista Lead at Highlands Coffee."
      )
    ).toBeInTheDocument()
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument()
  })

  it("honest-fails scan when the post has no title or company", async () => {
    renderApply()
    await expectApplyLive()

    fireEvent.click(screen.getByRole("button", { name: "Add job" }))
    const dialog = await screen.findByRole("dialog", { name: "Add job" })
    fireEvent.change(within(dialog).getByLabelText("Job text"), {
      target: { value: "Come work with us. Nice people." },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Scan" }))
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Couldn't find a title or company in that post."
    )
    expect(
      screen.queryByRole("complementary", { name: "Job detail" })
    ).not.toBeInTheDocument()
  })

  it("rolls a failed move back and shows the real error message", async () => {
    const { failNextApplyCommand } = await import("@/test/apply-api-mock.ts")
    const { APPLY_COMMANDS } = await import("@workspace/domain")
    failNextApplyCommand(APPLY_COMMANDS.moveCard, "Column is locked")

    renderApply()
    await expectApplyLive()

    dragCardToStage("Business analyst intern", "sent")

    expect(
      await screen.findByRole("alert", {}, { timeout: 2000 })
    ).toHaveTextContent("Column is locked")
    await waitFor(() => {
      expect(
        within(stageColumn("prep")).getByText("Business analyst intern")
      ).toBeInTheDocument()
    })
    expect(
      within(stageColumn("sent")).queryByText("Business analyst intern")
    ).not.toBeInTheDocument()
  })
})
