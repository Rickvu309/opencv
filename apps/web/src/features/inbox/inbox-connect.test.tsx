import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { InboxConnect } from "./inbox-connect.tsx"
import { GMAIL_UNAVAILABLE_COPY } from "./inbox-parts.tsx"

afterEach(() => {
  cleanup()
})

describe("inbox connect", () => {
  it("leads with the example inbox when Gmail cannot connect", async () => {
    const onSkip = vi.fn()
    const onExplore = vi.fn()
    render(
      <InboxConnect
        url={null}
        pending={false}
        onSkip={onSkip}
        onExplore={onExplore}
      />
    )
    expect(
      screen.getByText("Invites move jobs to Interview. Rejections close them.")
    ).toBeInTheDocument()
    expect(screen.getByText("Applied")).toBeInTheDocument()
    expect(screen.getByText("Interview")).toBeInTheDocument()
    expect(screen.queryByText("Sent")).not.toBeInTheDocument()
    expect(screen.queryByText("Live")).not.toBeInTheDocument()
    const explore = screen.getByRole("button", { name: "View example inbox" })
    const connect = screen.getByRole("button", { name: "Connect Gmail" })
    expect(explore).toBeEnabled()
    expect(explore).toHaveAttribute("data-variant", "primary")
    expect(explore).toHaveAttribute("aria-describedby", "inbox-gmail-hint")
    expect(connect).toBeDisabled()
    expect(screen.getByRole("button", { name: "Skip for now" })).toHaveClass(
      "-ms-2"
    )
    const hero = screen.getByRole("heading", {
      name: "Never miss a recruiter reply",
    })
    const column = hero.closest("section")
    expect(column?.className).toContain("overflow-y-auto")
    expect(column?.className).not.toContain("justify-center")
    expect(column?.firstElementChild?.className).toContain("my-auto")
    expect(hero.className).toContain("min-w-0")
    expect(hero.className).toContain("wrap-break-word")
    const aside = screen.getByRole("complementary", { name: "Example" })
    expect(aside.className).toContain("w-150")
    expect(aside.className).toContain("max-w-[600px]")
    expect(aside.className).toContain("shrink-0")
    expect(aside.className).not.toContain("justify-center")
    expect(connect).toHaveAttribute("data-variant", "outline")
    const hint = document.getElementById("inbox-gmail-hint")
    if (!hint) throw new Error("missing inbox-gmail-hint")
    expect(hint.textContent?.replace(/\s+/g, " ").trim()).toBe(
      GMAIL_UNAVAILABLE_COPY
    )
    expect(hint.querySelector("span")?.className).toContain("max-md:hidden")
    expect(
      explore.compareDocumentPosition(hint) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      hint.compareDocumentPosition(
        screen.getByRole("button", { name: "Skip for now" })
      ) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    await userEvent.click(explore)
    expect(onExplore).toHaveBeenCalledOnce()
    expect(onSkip).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole("button", { name: "Skip for now" }))
    expect(onSkip).toHaveBeenCalledOnce()
  })

  it("keeps Connect Gmail as the action when a connection url exists", () => {
    render(
      <InboxConnect
        url="https://accounts.example.com/gmail"
        pending={false}
        onSkip={vi.fn()}
        onExplore={vi.fn()}
      />
    )
    expect(screen.getByRole("button", { name: "Connect Gmail" })).toBeEnabled()
    expect(
      screen.getByRole("button", { name: "Connect Gmail" })
    ).toHaveAttribute("data-variant", "default")
    expect(
      screen.queryByRole("button", { name: "View example inbox" })
    ).toBeNull()
    expect(document.getElementById("inbox-gmail-hint")).toBeNull()
  })
})
