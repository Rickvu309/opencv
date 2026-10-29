import { emptyCvDocument, type PaperView } from "@workspace/domain"
import { StrictMode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, screen } from "@testing-library/react"

import { PaperSharePage } from "@/features/paper/paper-share-page.tsx"
import { render } from "@/test/render-with-client.tsx"

const state = vi.hoisted(() => ({ pathname: "/share/tok" }))

vi.mock("@tanstack/react-router", () => ({
  useRouterState: (options: {
    select: (routerState: { location: { pathname: string } }) => unknown
  }) => options.select({ location: { pathname: state.pathname } }),
}))

const shared: Omit<PaperView, "isFavorite"> = {
  id: "doc-1",
  name: "PM track CV",
  kind: "cv",
  templateId: "modern",
  status: "draft",
  document: emptyCvDocument(),
  contentVersion: 1,
  checks: [],
  pageChoice: "unset",
  sourceFileId: null,
  createdAt: "2020-01-01T00:00:00.000Z",
  updatedAt: "2020-01-01T00:00:00.000Z",
}

afterEach(() => {
  document.body.removeAttribute("data-print")
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  state.pathname = "/share/tok"
})

describe("Paper share page", () => {
  it("prints the row template when the body still says internship", async () => {
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/api/paper/shared/tok")) {
        return Promise.resolve(Response.json({ ok: true, data: shared }))
      }
      return Promise.resolve(Response.json({ ok: true, data: {} }))
    })
    expect(shared.document).toMatchObject({ templateId: "internship" })
    const view = render(<PaperSharePage />)
    expect(
      await screen.findByRole("heading", { name: "PM track CV" })
    ).toBeInTheDocument()
    expect(view.container.querySelector(".cv-template-product")).not.toBeNull()
    expect(view.container.querySelector(".cv-template-internship")).toBeNull()
  })

  it("prints the shared template from Download PDF", async () => {
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/api/paper/shared/tok")) {
        return Promise.resolve(Response.json({ ok: true, data: shared }))
      }
      return Promise.resolve(Response.json({ ok: true, data: {} }))
    })
    const print = vi.spyOn(window, "print").mockImplementation(() => {
      expect(document.body).toHaveAttribute("data-print", "paper")
      expect(
        document.querySelector("[data-paper-print] .cv-template-product")
      ).not.toBeNull()
      window.dispatchEvent(new Event("afterprint"))
    })
    render(<PaperSharePage />)
    fireEvent.click(await screen.findByRole("button", { name: "Download PDF" }))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(print).toHaveBeenCalledTimes(1)
  })

  it("shows no placeholder for an empty summary or an empty company", async () => {
    const quiet: Omit<PaperView, "isFavorite"> = {
      ...shared,
      templateId: "simple",
      document: {
        ...emptyCvDocument(),
        name: "Ada",
        summary: "",
        experience: [
          {
            role: "Product intern",
            company: "",
            period: "2024",
            bullets: ["Shipped the checklist"],
          },
        ],
      },
    }
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/api/paper/shared/tok")) {
        return Promise.resolve(Response.json({ ok: true, data: quiet }))
      }
      return Promise.resolve(Response.json({ ok: true, data: {} }))
    })
    render(<PaperSharePage />)
    expect(
      await screen.findByRole("heading", { name: "PM track CV" })
    ).toBeInTheDocument()
    const preview = document.querySelector("[data-paper-quiet]")
    expect(preview).not.toBeNull()
    expect(preview?.innerHTML ?? "").not.toContain("Add text")
    expect(preview?.querySelector("[aria-label='Company']")).toHaveAttribute(
      "hidden"
    )
    expect(preview?.querySelector("[aria-label='Summary']")).toHaveAttribute(
      "hidden"
    )
  })

  it("prints once in strict mode and unmounts the share sheet", async () => {
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/api/paper/shared/tok")) {
        return Promise.resolve(Response.json({ ok: true, data: shared }))
      }
      return Promise.resolve(Response.json({ ok: true, data: {} }))
    })
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined)
    render(
      <StrictMode>
        <PaperSharePage />
      </StrictMode>
    )
    fireEvent.click(await screen.findByRole("button", { name: "Download PDF" }))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30))
    })
    expect(print).toHaveBeenCalledTimes(1)
    expect(document.querySelector("[data-paper-print]")).not.toBeNull()
    act(() => {
      window.dispatchEvent(new Event("afterprint"))
    })
    expect(document.querySelector("[data-paper-print]")).toBeNull()
  })
})
