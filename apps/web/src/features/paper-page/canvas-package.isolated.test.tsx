import { ERROR_CODES } from "@workspace/domain/kernel"
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
      data: { user: { id: "owner-1" }, session: { id: "session-1" } },
      isPending: false,
      error: null,
    }),
  },
}))

function lineOf(handle: string, text: string) {
  return {
    handle,
    text,
    pieces: text === "" ? [] : [{ text, editable: true }],
    held: false,
    message: "",
    code: null,
  }
}

function heldOf(handle: string, text: string, message: string) {
  return {
    handle,
    text,
    pieces: [{ text, editable: false }],
    held: true,
    message,
    code: "NOT_BODY",
  }
}

function page(paragraphs: unknown[]) {
  return {
    doc: DOC,
    revision: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    name: "Page.docx",
    label: "letter",
    paragraphs,
  }
}

function metadata() {
  return Response.json({
    ok: true,
    data: { id: DOC, name: "Page.docx", kind: "letter", format: "word" },
  })
}

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe("minted package page", () => {
  it("opens the empty paragraph from the saved document", async () => {
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith(`/api/paper/${DOC}/document`))
        return Promise.resolve(metadata())
      if (url.includes("/api/reads/paper.read")) {
        return Promise.resolve(
          Response.json({
            ok: true,
            data: page([lineOf(WRITING, "")]),
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
    expect(document.querySelector("p.writing-note")).toHaveTextContent(
      "Writing is not saved yet"
    )
  })

  it("leaves an imported file on the missing page", async () => {
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith(`/api/paper/${DOC}/document`))
        return Promise.resolve(metadata())
      if (url.includes("/api/reads/paper.read")) {
        return Promise.resolve(
          Response.json({
            ok: true,
            data: page([]),
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

  it("shows the rest of an imported file and why a part is locked", async () => {
    const later = "c33c33c3-c33c-4c33-8c33-c33c33c33c33"
    const locked = "d44d44d4-d44d-4d44-8d44-d44d44d44d44"
    const message = "This part stays locked."
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith(`/api/paper/${DOC}/document`)) return metadata()
      if (url.includes("/api/reads/paper.read"))
        return Response.json({
          ok: true,
          data: page([
            lineOf(WRITING, "First paragraph"),
            heldOf(locked, "Locked line", message),
            lineOf(later, "Later paragraph"),
          ]),
        })
      return Response.json(
        {
          ok: false,
          error: { code: ERROR_CODES.NOT_FOUND, message: "Missing" },
        },
        { status: 404 }
      )
    })
    render(<PaperDocPage />)
    expect(await screen.findByText("Later paragraph")).toBeVisible()
    const article = screen.getByRole("article", { name: "Page" })
    expect(
      [...article.querySelectorAll(":scope > p")].map((node) =>
        (node.textContent ?? "").replaceAll("\u200b", "")
      )
    ).toEqual(["First paragraph", "Locked line", "Later paragraph"])
    expect(screen.getByText(message)).toBeVisible()
    expect(
      article
        .querySelector(`p[data-block="${locked}"]`)
        ?.getAttribute("contenteditable")
    ).toBe("false")
  })
})
