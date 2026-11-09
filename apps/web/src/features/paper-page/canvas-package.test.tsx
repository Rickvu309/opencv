import { ERROR_CODES } from "@workspace/domain"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, screen } from "@testing-library/react"

import { render } from "@/test/render-with-client.tsx"
import { PaperDocPage } from "@/routes/paper-doc.tsx"

const DOC = "22222222-2222-4222-8222-222222222222"
const WRITING = "a11a11a1-a11a-4a11-8a11-a11a11a11a11"
const CARRIER = "b22b22b2-b22b-4b22-8b22-b22b22b22b22"

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => () => undefined,
  useRouterState: (options: {
    select: (state: {
      location: { pathname: string; search: Record<string, never> }
    }) => unknown
  }) =>
    options.select({
      location: { pathname: `/paper/${DOC}`, search: {} },
    }),
}))

vi.mock("@/lib/auth-client.ts", () => ({
  authClient: {
    useSession: () => ({
      data: { user: { id: "owner-1" } },
      isPending: false,
      error: null,
    }),
  },
}))

function page(regions: unknown[]) {
  return {
    generation: "package",
    docId: DOC,
    revision: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    name: "Page.docx",
    kind: "letter",
    packageHash: "ab".repeat(32),
    byteSize: 128,
    projector: "paper-package-spans-1",
    regions,
    nextCursor: null,
  }
}

function region(
  paragraph: string,
  code: string,
  kind: "locked" | "editable" = "locked"
) {
  if (kind === "editable") {
    return {
      kind,
      paragraph,
      targetId: `t_${"ab".repeat(32)}`,
      text: "Hi",
      location: { paragraph: 1, kind: "paragraph" },
      formatting: { kind: "inherited", scope: "preserved-uncomputed" },
      context: { paragraphText: "Hi" },
    }
  }
  return {
    kind,
    paragraph,
    text: "",
    location: { paragraph: paragraph === CARRIER ? 2 : 1, kind: "paragraph" },
    reason: { code, message: code },
    complete: true,
    continuation: false,
  }
}

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe("minted package page", () => {
  it("opens the empty paragraph from the saved document", async () => {
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/api/reads/paper.read")) {
        return Promise.resolve(
          Response.json({
            ok: true,
            data: page([
              region(WRITING, "EMPTY_TARGET"),
              region(CARRIER, "UNSUPPORTED_TARGET_PROPERTY"),
            ]),
          })
        )
      }
      return Promise.resolve(
        Response.json(
          {
            ok: false,
            error: { code: ERROR_CODES.NOT_FOUND, message: "Missing" },
          },
          { status: 404 }
        )
      )
    })
    render(<PaperDocPage />)
    expect(await screen.findByRole("article", { name: "Page" })).toBeVisible()
    expect(document.querySelector(`p[data-block="${WRITING}"]`)).not.toBeNull()
    expect(document.querySelector(`p[data-block="${CARRIER}"]`)).toBeNull()
    expect(screen.getByRole("status")).toHaveTextContent(
      "Writing is not saved yet"
    )
  })

  it("leaves an imported file on the missing page", async () => {
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/api/reads/paper.read")) {
        return Promise.resolve(
          Response.json({
            ok: true,
            data: page([
              {
                kind: "locked",
                text: "Imported",
                location: { paragraph: 1, kind: "paragraph" },
                reason: { code: "EMPTY_TARGET", message: "Empty" },
                complete: true,
                continuation: false,
              },
            ]),
          })
        )
      }
      return Promise.resolve(
        Response.json(
          {
            ok: false,
            error: { code: ERROR_CODES.NOT_FOUND, message: "Missing" },
          },
          { status: 404 }
        )
      )
    })
    render(<PaperDocPage />)
    expect(await screen.findByText("Document not found.")).toBeVisible()
  })
})
