import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { Toaster } from "@workspace/ui/components/sonner"

import { reportRejected } from "./command-failure.ts"

afterEach(() => cleanup())

async function shown(text: string) {
  await waitFor(() => {
    const node = screen.getByText(text)
    expect(node).toBeVisible()
    expect(node.closest("[data-sonner-toast]")).toHaveAttribute(
      "data-mounted",
      "true"
    )
  })
}

describe("reportRejected", () => {
  it("tells the user why the server turned the change down, in its words", async () => {
    render(<Toaster />)

    act(() =>
      reportRejected("move the job")(new Error("That job was deleted."))
    )

    await shown("That job was deleted.")
  })

  it("asks the user to try again when the server gave no reason", async () => {
    render(<Toaster />)

    act(() => reportRejected("move the job")("offline"))

    await shown("Could not move the job. Try again.")
  })
})
