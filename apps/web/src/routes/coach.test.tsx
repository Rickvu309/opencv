import { afterEach, describe, expect, it } from "vitest"
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react"

import { renderApp } from "@/test/render-app.tsx"
import { setMockJobs } from "@/test/shell-api-mock.ts"
import {
  getCoachCommandCalls,
  getLastNativeTurn,
  scriptCoachStream,
  setMockCoachUsage,
} from "@/test/threads-api-mock.ts"
import { setProfileUpdatePlanRequired } from "@/test/profile-api-mock.ts"

afterEach(() => {
  cleanup()
})

async function openCoach() {
  renderApp("/app/coach")
  expect(
    await screen.findByRole("heading", { name: "How can I help?" })
  ).toBeInTheDocument()
}

describe("coach page", () => {
  it("shows six starters and fills the composer from a starter", async () => {
    await openCoach()
    for (const label of [
      "Review my CV",
      "Find roles",
      "Prep an interview",
      "Write a cover letter",
      "Plan my week",
      "Negotiate an offer",
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument()
    }
    fireEvent.click(screen.getByRole("button", { name: "More ideas" }))
    expect(
      screen.getByRole("button", { name: "Compare two offers" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Review my CV" })
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Review my CV" }))
    expect(screen.getByRole("textbox", { name: "Message Coach" })).toHaveValue(
      "Review my CV"
    )
  })

  it("streams step rows, one reply, and the worked line", async () => {
    scriptCoachStream({
      texts: ["I looked at Apply. ", "Prep the starred one next."],
      steps: ["List jobs"],
      workedMs: 1100,
    })
    await openCoach()
    fireEvent.change(screen.getByRole("textbox", { name: "Message Coach" }), {
      target: { value: "Prep the starred role" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Send" }))
    expect(await screen.findByText("List jobs")).toBeInTheDocument()
    expect(
      await screen.findByText("I looked at Apply. Prep the starred one next.")
    ).toBeInTheDocument()
    expect(await screen.findByText("Worked for 1s")).toBeInTheDocument()
  })

  it("keeps one stopped bubble and posts stop", async () => {
    scriptCoachStream({ gated: true, texts: ["Partial answer"] })
    await openCoach()
    fireEvent.change(screen.getByRole("textbox", { name: "Message Coach" }), {
      target: { value: "Keep going" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Send" }))
    fireEvent.click(await screen.findByRole("button", { name: "Stop" }))
    expect(await screen.findByText("Stopped")).toBeInTheDocument()
    expect(screen.getByText("Keep going")).toBeInTheDocument()
    expect(screen.getAllByText("Stopped", { selector: "p" })).toHaveLength(1)
    await waitFor(() => {
      expect(
        getCoachCommandCalls().some((call) => call.name === "coach.stop")
      ).toBe(true)
    })
  })

  it("lists Paper docs, Apply jobs, and a pasted link", async () => {
    setMockJobs([
      {
        id: "33333333-3333-4333-8333-333333333333",
        title: "Associate PM",
        company: "Northwind",
        starred: true,
      },
    ])
    await openCoach()
    fireEvent.click(screen.getByRole("button", { name: "Add context" }))
    expect(
      (await screen.findAllByRole("menuitem", { name: "PM track CV" })).length
    ).toBeGreaterThan(0)
    expect(
      screen.getByRole("menuitem", { name: "Associate PM Northwind" })
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("menuitem", { name: "Paste a job link" }))
    const link = await screen.findByRole("textbox", {
      name: "Paste a job link",
    })
    fireEvent.change(link, { target: { value: "not a link" } })
    fireEvent.keyDown(link, { key: "Enter" })
    expect(await screen.findByText("Paste a full link.")).toBeInTheDocument()
    fireEvent.change(link, { target: { value: "https://example.com/jobs/1" } })
    fireEvent.keyDown(link, { key: "Enter" })
    fireEvent.change(screen.getByRole("textbox", { name: "Message Coach" }), {
      target: { value: "Look at this role" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Send" }))
    await screen.findByText(/I looked at Apply/)
    expect(getLastNativeTurn()?.attachments).toEqual([
      {
        kind: "link",
        id: "https://example.com/jobs/1",
        label: "https://example.com/jobs/1",
      },
    ])
  })

  it("reads caps from usage and leaves Free when Max needs Pro", async () => {
    setMockCoachUsage({
      caps: { free: 7, light: 4, max: 2 },
      day: {
        capped: false,
        remaining: 6,
        cap: 7,
        resetsAt: "2026-10-28T00:00:00.000Z",
      },
    })
    await openCoach()
    fireEvent.click(screen.getByRole("button", { name: "Free" }))
    expect(
      await screen.findByText("Quick edits, 6 of 7 left today")
    ).toBeInTheDocument()
    expect(screen.getByText("Stronger drafts, 4 a day")).toBeInTheDocument()
    expect(screen.getByText("Hardest rewrites, 2 a day")).toBeInTheDocument()
    expect(screen.getAllByText("Pro").length).toBeGreaterThan(0)
    cleanup()

    setProfileUpdatePlanRequired(true)
    const { router } = renderApp("/app/coach")
    await screen.findByRole("heading", { name: "How can I help?" })
    fireEvent.click(screen.getByRole("button", { name: "Free" }))
    fireEvent.click(await screen.findByRole("menuitemradio", { name: /Max/ }))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(
        "/app/settings/billing/upgrade"
      )
    })
  })

  it("approves a confirm part and undoes a result card", async () => {
    const pendingActionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    const activityId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    scriptCoachStream({
      texts: ["I updated the CV."],
      confirm: {
        pendingActionId,
        command: "paper.updateContent",
        summary: "Update the CV",
      },
      result: {
        activityId,
        name: "Junior Marketing CV",
        summary: "3 changes",
        changes: 3,
        docId: "11111111-1111-7111-8111-111111111111",
      },
    })
    await openCoach()
    fireEvent.change(screen.getByRole("textbox", { name: "Message Coach" }), {
      target: { value: "Tighten the bullets" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Send" }))
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }))
    await waitFor(() => {
      expect(
        getCoachCommandCalls().some((call) => call.name === "actions.approve")
      ).toBe(true)
    })
    expect(screen.getByText("Junior Marketing CV")).toBeInTheDocument()
    expect(screen.getByText("3 changes")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Undo" }))
    await waitFor(() => {
      expect(screen.getByText("Undone")).toBeInTheDocument()
    })
    expect(
      screen.queryByRole("button", { name: "Undo" })
    ).not.toBeInTheDocument()
    expect(
      getCoachCommandCalls().some((call) => call.name === "activity.undo")
    ).toBe(true)
  })

  it("shows a sentence when the turn answers 404", async () => {
    scriptCoachStream({
      httpError: {
        status: 404,
        code: "USER_NOT_FOUND",
        message: "User not found.",
      },
    })
    await openCoach()
    fireEvent.change(screen.getByRole("textbox", { name: "Message Coach" }), {
      target: { value: "hello" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Send" }))
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("Sign in again")
    expect(alert).not.toHaveTextContent("User not found.")
  })
})
