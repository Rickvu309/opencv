import { emptyCvDocument, type PaperView } from "@workspace/domain"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, screen } from "@testing-library/react"

import { PaperSharePage } from "@/features/paper/paper-share-page.tsx"
import { render } from "@/test/render-with-client.tsx"

const state = vi.hoisted(() => ({ pathname: "/share/tok" }))

vi.mock("@tanstack/react-router", () => ({
  useRouterState: (options: {
    select: (routerState: { location: { pathname: string } }) => unknown
  }) => options.select({ location: { pathname: state.pathname } }),
}))

const shared: PaperView = {
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
  cleanup()
  vi.unstubAllGlobals()
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
})
