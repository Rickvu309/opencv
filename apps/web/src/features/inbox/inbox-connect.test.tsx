import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { InboxConnect } from "./inbox-connect.tsx"

afterEach(() => {
  cleanup()
})

describe("inbox connect", () => {
  it("keeps Connect Gmail as the only glow and still offers Skip", async () => {
    const onSkip = vi.fn()
    const view = render(
      <InboxConnect url={null} pending={false} onSkip={onSkip} />
    )
    const glows = view.container.querySelectorAll(".glow")
    expect(glows).toHaveLength(1)
    expect(glows[0]).toHaveAccessibleName("Connect Gmail")
    expect(glows[0]).toBeDisabled()
    expect(
      screen.getByText(
        "Gmail is not connected on this server. You can skip for now."
      )
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Skip for now" }))
    expect(onSkip).toHaveBeenCalledOnce()
  })
})
