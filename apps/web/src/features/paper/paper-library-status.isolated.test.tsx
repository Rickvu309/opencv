import { describe, expect, it, vi } from "vitest"
import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { render } from "@/test/render-with-client.tsx"

import { PaperLibrary } from "./paper-library.tsx"
import { cv, renderLibrary } from "./paper-library.fixtures.tsx"

const { listJobs } = vi.hoisted(() => ({
  listJobs: vi.fn((): Promise<unknown[]> => Promise.resolve([])),
}))
vi.mock("@/features/apply/apply-api.ts", () => ({ listJobs }))

describe("Paper library status", () => {
  it("announces library loading and a load error", () => {
    const props = {
      docs: [],
      files: [],
      onRetry: () => undefined,
      onOpen: () => undefined,
      query: "",
      onQueryChange: () => undefined,
    }
    const { unmount } = render(<PaperLibrary {...props} loading error={null} />)
    expect(screen.getByRole("status")).toHaveTextContent("Loading documents…")
    unmount()
    render(
      <PaperLibrary
        {...props}
        loading={false}
        error="Could not load documents."
      />
    )
    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent("Could not load documents.")
    expect(alert.className).toMatch(/text-destructive/)
  })

  it("offers Apply when a page has no job to link", async () => {
    listJobs.mockResolvedValueOnce([])
    const user = userEvent.setup()
    renderLibrary([cv("My CV")])
    await user.click(screen.getByRole("button", { name: "My CV menu" }))
    await user.click(
      await screen.findByRole("menuitem", { name: "Link to application" })
    )
    const dialog = await screen.findByRole("dialog", {
      name: "Link to application",
    })
    expect(await within(dialog).findByText("No jobs yet.")).toBeInTheDocument()
    const apply = within(dialog).getByRole("link", {
      name: "Add a job in Apply",
    })
    expect(apply).toHaveAttribute("href", "/apply")
    expect(apply.className.split(" ")).toContain("h-11")
    expect(apply.className.split(" ")).not.toContain("h-8")
    expect(within(dialog).queryByRole("status")).not.toBeInTheDocument()
    expect(dialog.querySelector("[data-slot=paper-link-jobs]")).toBeNull()
  })

  it("caps the job list so a long board scrolls inside the dialog", async () => {
    listJobs.mockResolvedValueOnce(
      Array.from({ length: 8 }, (_, index) => ({
        id: `job-${index}`,
        title: `Role ${index}`,
        company: "Acme",
        posting: {},
        cvDocId: null,
        letterDocId: null,
        updatedAt: "2026-08-25T12:00:00.000Z",
      }))
    )
    const user = userEvent.setup()
    renderLibrary([cv("My CV")])
    await user.click(screen.getByRole("button", { name: "My CV menu" }))
    await user.click(
      await screen.findByRole("menuitem", { name: "Link to application" })
    )
    const dialog = await screen.findByRole("dialog", {
      name: "Link to application",
    })
    const list = dialog.querySelector("[data-slot=paper-link-jobs]")
    expect(list?.className).toMatch(/max-h-72/)
    expect(list?.className).toMatch(/overflow-y-auto/)
    expect(
      within(dialog).getByRole("button", { name: "Role 7, Acme" })
    ).toBeInTheDocument()
    expect(within(dialog).queryByText("No jobs yet.")).not.toBeInTheDocument()
  })
})
