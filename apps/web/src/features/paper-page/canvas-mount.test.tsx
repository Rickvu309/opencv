import { Component, type ReactNode } from "react"
import { blankLetter } from "@workspace/domain"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, screen } from "@testing-library/react"

import { render } from "@/test/render-with-client.tsx"
import { PaperDocPage } from "@/routes/paper-doc.tsx"

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

const WORD_PAGE = "22222222-2222-4222-8222-222222222222"

const wordPageListed = {
  id: WORD_PAGE,
  name: "Cover letter.docx",
  kind: "letter",
  templateId: "simple",
  status: "draft",
  paper: blankLetter(),
  contentVersion: 1,
  checks: [],
  pageChoice: "unset",
  isFavorite: false,
  sourceFileId: null,
  format: "word",
  createdAt: "2026-11-13T00:00:00.000Z",
  updatedAt: "2026-11-13T00:00:00.000Z",
}

function json(data: unknown) {
  return Promise.resolve(Response.json({ ok: true, data }))
}

function stubWordPage() {
  vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.endsWith("/api/paper")) {
      return json([wordPageListed])
    }
    if (url.includes(`/api/paper/${WORD_PAGE}`)) {
      return Promise.resolve(
        Response.json(
          { ok: false, error: { code: "NOT_FOUND", message: "Not found" } },
          { status: 404 }
        )
      )
    }
    if (url.includes("/api/reads/paper.read")) {
      return json({
        doc: WORD_PAGE,
        revision: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        name: "Cover letter.docx",
        label: "letter",
        paragraphs: [
          {
            handle: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            text: "",
            pieces: [],
            held: false,
            message: "",
            code: null,
          },
        ],
      })
    }
    if (url.includes("/api/chats") || url.includes("/api/jobs")) return json([])
    return new Promise<Response>(() => undefined)
  })
}

afterEach(() => {
  cleanup()
})

describe("Paper document mount", () => {
  it("opens a blank Word page on the writing page", async () => {
    route.pathname = `/paper/${WORD_PAGE}`
    stubWordPage()
    render(
      <EditorBoundary>
        <PaperDocPage />
      </EditorBoundary>
    )
    expect(await screen.findByRole("article", { name: "Page" })).toBeVisible()
    expect(screen.queryByRole("region", { name: /Editing/ })).toBeNull()
  })
})
