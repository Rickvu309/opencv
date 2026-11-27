import {
  act,
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { renderApp } from "@/test/render-app.tsx"
import { mockJob } from "@/test/apply-job-fixtures.ts"
import { getMockJobPosts, setMockJobs } from "@/test/apply-jobs-mock.ts"

const first = mockJob({ title: "First role", company: "Alpha" })
const second = mockJob({
  id: "01900000-0000-7000-8000-000000000051",
  title: "Second role",
  company: "Beta",
  position: "a1",
})
const later = mockJob({
  id: "01900000-0000-7000-8000-000000000052",
  title: "Offer role",
  company: "Gamma",
  stage: "offer",
})

async function press(target: Element | Document | Window, key: string) {
  await act(async () => {
    fireEvent.keyDown(target, { key, code: key })
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

describe("apply side panel and keyboard", () => {
  afterEach(() => {
    cleanup()
  })

  it("steps through jobs with J and K and closes with Escape while the board stays", async () => {
    setMockJobs([first, second, later])
    const { router } = renderApp(`/apply?job=${first.id}`)
    const peek = await screen.findByRole("complementary", { name: "Job" })
    await within(peek).findByRole("heading", { name: "First role" })
    expect(within(peek).getByText("1 / 3")).toBeInTheDocument()

    await press(window, "j")
    await within(peek).findByRole("heading", { name: "Second role" })
    expect(router.state.location.search).toMatchObject({ job: second.id })

    await press(window, "k")
    await within(peek).findByRole("heading", { name: "First role" })

    await press(window, "Escape")
    await waitFor(() =>
      expect(
        screen.queryByRole("complementary", { name: "Job" })
      ).not.toBeInTheDocument()
    )
    expect(router.state.location.search).not.toHaveProperty("job")
    expect(screen.getByRole("region", { name: "Saved" })).toBeInTheDocument()
  })

  it("moves focus between cards with the arrow keys and lets the panel follow", async () => {
    setMockJobs([first, second, later])
    const { router } = renderApp("/apply")
    await screen.findByRole("region", { name: "Saved" })
    await press(window, "ArrowDown")
    const firstCard = screen.getByRole("button", {
      name: "First role, Alpha",
    })
    expect(firstCard).toHaveFocus()

    await press(firstCard, "ArrowDown")
    const secondCard = screen.getByRole("button", {
      name: "Second role, Beta",
    })
    expect(secondCard).toHaveFocus()

    await press(secondCard, "ArrowRight")
    expect(
      screen.getByRole("button", { name: "Offer role, Gamma" })
    ).toHaveFocus()

    await press(document.activeElement as Element, "Enter")
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ job: later.id })
    )
    await press(document.activeElement as Element, "ArrowLeft")
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ job: first.id })
    )
  })

  it("changes a card's stage with S and a number, then undoes it with Z", async () => {
    setMockJobs([first, second])
    renderApp("/apply")
    const card = await screen.findByRole("button", {
      name: "First role, Alpha",
    })
    card.focus()
    await press(card, "s")
    const menu = await screen.findByRole("menu", { name: "Move to stage" })
    expect(
      within(menu).getByRole("menuitem", { name: /Saved/ })
    ).toHaveAttribute("aria-disabled", "true")
    await press(menu, "3")
    await waitFor(() =>
      expect(
        within(screen.getByRole("region", { name: "Interview" })).getByRole(
          "button",
          { name: "First role, Alpha" }
        )
      ).toBeInTheDocument()
    )
    await waitFor(() =>
      expect(
        getMockJobPosts().some(
          (post) =>
            post.name === "job.move" &&
            JSON.stringify(post.input).includes('"interview"')
        )
      ).toBe(true)
    )
    expect(await screen.findByText("Moved to Interview")).toBeInTheDocument()

    await press(window, "z")
    await waitFor(() =>
      expect(
        getMockJobPosts().some((post) => post.name === "activity.undo")
      ).toBe(true)
    )
  })

  it("lists what is next above the board and opens it in the side panel", async () => {
    setMockJobs([first, later])
    const { router } = renderApp("/apply")
    const strip = await screen.findByRole("region", { name: "Next up" })
    const item = within(strip).getByRole("button", {
      name: /Gamma.*Answer the offer/,
    })
    fireEvent.click(item)
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ job: later.id })
    )
  })
})
