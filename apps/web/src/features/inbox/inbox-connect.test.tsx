import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { InboxConnect } from "./inbox-connect.tsx"

afterEach(() => {
  cleanup()
})

describe("inbox connect", () => {
  it("disables Connect Gmail without a url and still offers Skip", async () => {
    const onSkip = vi.fn()
    render(<InboxConnect url={null} pending={false} onSkip={onSkip} />)
    expect(
      screen.getByText("Invites move jobs to Interview. Rejections close them.")
    ).toBeInTheDocument()
    expect(screen.getByText("Applied")).toBeInTheDocument()
    expect(screen.getByText("Interview")).toBeInTheDocument()
    expect(screen.queryByText("Sent")).not.toBeInTheDocument()
    expect(screen.queryByText("Live")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Connect Gmail" })).toBeDisabled()
    expect(
      screen.getByText(
        "Gmail is not connected on this server. You can skip for now."
      )
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Skip for now" }))
    expect(onSkip).toHaveBeenCalledOnce()
  })
})
