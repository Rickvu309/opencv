import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, screen, within } from "@testing-library/react"

import { SURFACE_PATHS } from "@/features/app-shell/surfaces.ts"
import { renderApp } from "@/test/render-app.tsx"

afterEach(() => {
  vi.useRealTimers()
  cleanup()
  vi.unstubAllGlobals()
})

describe("Apply posting link copy", () => {
  it("shows Copied after Copy link and clears it after 2 seconds", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } })

    renderApp(SURFACE_PATHS.apply)
    expect(
      await screen.findByRole("heading", { level: 1, name: "Apply" })
    ).toBeInTheDocument()
    fireEvent.click(await screen.findByRole("button", { name: "Add job" }))
    const dialog = await screen.findByRole("dialog", { name: "Add job" })
    fireEvent.change(within(dialog).getByLabelText("Job posting URL"), {
      target: { value: "linkedin.com/jobs/view/123" },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Add job" }))
    const panel = await screen.findByRole("complementary", {
      name: "Job detail",
    })

    vi.useFakeTimers()
    fireEvent.click(within(panel).getByRole("button", { name: "Copy link" }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(writeText).toHaveBeenCalledWith("https://linkedin.com/jobs/view/123")
    expect(
      within(panel).getByRole("button", { name: "Copied" })
    ).toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1999)
    })
    expect(
      within(panel).getByRole("button", { name: "Copied" })
    ).toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(
      within(panel).queryByRole("button", { name: "Copied" })
    ).not.toBeInTheDocument()
    expect(
      within(panel).getByRole("button", { name: "Copy link" })
    ).toBeInTheDocument()
  })
})
