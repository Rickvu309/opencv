import { Component, type ReactNode } from "react"
import { blankCv, parsePaperId, type PaperView } from "@workspace/domain"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, screen } from "@testing-library/react"

import { render } from "@/test/render-with-client.tsx"
import { PaperDocPage } from "@/routes/paper-doc.tsx"

const BLANK = "11111111-1111-7111-8111-111111111111"

const route = vi.hoisted(() => ({
  pathname: "/paper/11111111-1111-7111-8111-111111111111",
}))

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => () => undefined,
  useRouterState: (options: {
    select: (state: {
      location: { pathname: string; search: Record<string, never> }
    }) => unknown
  }) =>
    options.select({
      location: { pathname: route.pathname, search: {} },
    }),
}))

class EditorBoundary extends Component<
  { children: ReactNode },
  { message: string }
> {
  state = { message: "" }

  static getDerivedStateFromError(error: Error) {
    return { message: error.message }
  }

  render() {
    if (this.state.message) return <p>{this.state.message}</p>
    return this.props.children
  }
}

function view(
  id: string,
  kind: PaperView["kind"],
  paper: PaperView["paper"],
  name: string
): PaperView {
  return {
    id: parsePaperId(id),
    name,
    kind,
    templateId: kind === "letter" ? null : "simple",
    status: "draft",
    paper,
    contentVersion: 1,
    checks: [],
    pageChoice: "unset",
    isFavorite: false,
    sourceFileId: null,
    createdAt: "2020-01-01T00:00:00.000Z",
    updatedAt: "2020-01-01T00:00:00.000Z",
  }
}

function stub(doc: PaperView) {
  vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
    const url = String(input)
    const json = (data: unknown) =>
      Promise.resolve(Response.json({ ok: true, data }))
    if (url.includes("/pages")) {
      return json({ docId: doc.id, pages: 1, pageChoice: "unset" })
    }
    if (url.includes(`/api/paper/${doc.id}`)) return json(doc)
    if (url.includes("/api/chats") || url.includes("/api/jobs")) return json([])
    return json({})
  })
}

function show(doc: PaperView) {
  route.pathname = `/paper/${doc.id}`
  stub(doc)
  return render(
    <EditorBoundary>
      <PaperDocPage />
    </EditorBoundary>
  )
}

afterEach(() => {
  cleanup()
})

describe("Paper document mount", () => {
  it("opens a new document on the writing page", async () => {
    show(view(BLANK, "cv", blankCv(), "Draft"))
    expect(await screen.findByRole("article", { name: "Page" })).toBeVisible()
    expect(screen.getByRole("status")).toHaveTextContent(
      "Writing is not saved yet"
    )
    expect(screen.queryByRole("region", { name: /Editing/ })).toBeNull()
  })
})
