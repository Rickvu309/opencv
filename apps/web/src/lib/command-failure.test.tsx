import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { Toaster } from "@workspace/ui/components/sonner"

import { reportRejected } from "./command-failure.ts"

afterEach(() => cleanup())

describe("reportRejected", () => {
  it("tells the user why the server turned the change down, in its words", async () => {
    render(<Toaster />)

    act(() =>
      reportRejected("move the job")(new Error("That job was deleted."))
    )

    expect(await screen.findByText("That job was deleted.")).toBeVisible()
  })

  it("asks the user to try again when the server gave no reason", async () => {
    render(<Toaster />)

    act(() => reportRejected("move the job")("offline"))

    expect(
      await screen.findByText("Could not move the job. Try again.")
    ).toBeVisible()
  })
})
