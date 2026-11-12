import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, screen } from "@testing-library/react"

import { scriptCoachStream } from "@/test/chat-api-mock.ts"
import { SURFACE_PATHS } from "@/lib/product-paths.ts"
import { renderApp } from "@/test/render-app.tsx"
import {
  expectCoachIdle,
  expectSendSettled,
  sendMessage,
  stepButton,
} from "@/test/coach-chat-helpers.ts"

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn())
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("Coach Command receipts", { timeout: 15_000 }, () => {
  it("undoes a reversible receipt and marks it undone", async () => {
    scriptCoachStream({
      parts: [
        { kind: "text", text: "Moved it." },
        {
          kind: "tool",
          name: "job.move",
          summary: "Moved 'Backend Intern' to Prep",
          ok: true,
          reversal: {
            possible: true,
            command: "job.move",
            description:
              "Undo by moving the card back to its previous Stage and order.",
            input: {
              cardId: "11111111-1111-4111-8111-111111111111",
              stage: "inbox",
              beforeCardId: null,
            },
          },
        },
      ],
    })
    renderApp(SURFACE_PATHS.coach)
    await expectCoachIdle()
    await sendMessage("Move the intern card to Prep")
    await expectSendSettled("Move the intern card to Prep")

    fireEvent.click(screen.getByRole("button", { name: "Undo" }))
    expect(await screen.findByText("Undone")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Undo" })
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/finished$/)).not.toBeInTheDocument()
  })

  it("states a failed undo plainly and keeps the original undo", async () => {
    scriptCoachStream({
      undoFail: { summary: "Apply card not found" },
      parts: [
        {
          kind: "tool",
          name: "job.move",
          summary: "Moved 'Backend Intern' to Prep",
          ok: true,
          reversal: {
            possible: true,
            command: "job.move",
            description:
              "Undo by moving the card back to its previous Stage and order.",
            input: {
              cardId: "11111111-1111-4111-8111-111111111111",
              stage: "inbox",
            },
          },
        },
      ],
    })
    renderApp(SURFACE_PATHS.coach)
    await expectCoachIdle()
    await sendMessage("Move a card that later vanished")
    await expectSendSettled("Move a card that later vanished")

    fireEvent.click(screen.getByRole("button", { name: "Undo" }))
    expect(
      await screen.findByText(/Couldn't undo this change/)
    ).toBeInTheDocument()
    expect(screen.queryByText("Undone")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Undo/ })).toBeEnabled()
  })

  it("keeps irreversible receipts as read-only notes", async () => {
    scriptCoachStream({
      parts: [
        {
          kind: "tool",
          name: "job.list",
          summary: "Listed 2 Apply cards",
          ok: true,
          reversal: {
            possible: false,
            description: "This read does not change anything.",
          },
        },
      ],
    })
    renderApp(SURFACE_PATHS.coach)
    await expectCoachIdle()
    await sendMessage("What cards do I have?")
    expect(await screen.findByText("Looked at your Jobs")).toBeInTheDocument()
    expect(
      screen.queryByText("This read does not change anything.")
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Undo" })
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/Reversible —/)).not.toBeInTheDocument()
  })

  it("renders a failed Command receipt plainly", async () => {
    scriptCoachStream({
      parts: [
        {
          kind: "tool",
          name: "job.move",
          summary: "Apply card not found",
          ok: false,
        },
      ],
    })
    renderApp(SURFACE_PATHS.coach)
    await expectCoachIdle()
    await sendMessage("Move a missing card")
    expect(
      await screen.findByRole("button", {
        name: stepButton("Apply card not found"),
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Apply card not found failed: Nothing changed\./)
    ).toBeInTheDocument()
    expect(screen.getByText("Nothing changed.")).toBeInTheDocument()
    expect(screen.queryByText(/Reversible —/)).not.toBeInTheDocument()
  })

  it("humanizes a failed job.move Zod dump and keeps it in the column", async () => {
    scriptCoachStream({
      parts: [
        {
          kind: "tool",
          name: "job.move",
          summary:
            'Invalid input for tool apply_moveCard: Type validation failed: Value: {"cardId":"00000000-0000-0000-0000-000000000002"}. Error message: [{"code":"invalid_format","pattern":"/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}$/","message":"Invalid UUID"}]',
          ok: false,
        },
      ],
    })
    renderApp(SURFACE_PATHS.coach)
    await expectCoachIdle()
    await sendMessage("Move card 00000000-0000-0000-0000-000000000002 to Prep")

    const receipt = await screen.findByRole("button", {
      name: /That card id isn't valid/,
    })
    expect(receipt).toHaveTextContent("That card id isn't valid")
    expect(receipt).not.toHaveTextContent(
      /Invalid input for tool|Type validation failed|Invalid UUID/
    )
    expect(receipt.textContent ?? "").not.toContain("{")
    expect(receipt.textContent ?? "").not.toContain("[")
    expect(receipt.textContent).not.toMatch(/\/\^|\\d\{/)
    expect(screen.queryByText(/Reversible —/)).not.toBeInTheDocument()
  })
})
