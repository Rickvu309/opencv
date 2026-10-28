import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, screen } from "@testing-library/react"
import type { ReactElement } from "react"
import {
  cvCodecToBlocks,
  emptyCvDocument,
  type CvDocument,
  type PaperPages,
  type PaperView,
} from "@workspace/domain"

import { ChatStoreProvider } from "@/features/coach/chat-store.tsx"
import { render as renderWithClient } from "@/test/render-with-client.tsx"

import { PaperCvEditor } from "./paper-editor.tsx"
import { PaperSharePage } from "./paper-share-page.tsx"

function render(ui: ReactElement) {
  return renderWithClient(<ChatStoreProvider>{ui}</ChatStoreProvider>)
}

const state = vi.hoisted(() => ({ pathname: "/share/tok" }))

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>()
  return {
    ...actual,
    useRouterState: (options: {
      select: (routerState: { location: { pathname: string } }) => unknown
    }) => options.select({ location: { pathname: state.pathname } }),
  }
})

const fixture: CvDocument = {
  ...emptyCvDocument(),
  templateId: "internship",
  name: "Lan Nguyen",
  headline: "Product intern",
  contact: {
    email: "lan@example.com",
    phone: "+84 912 345 678",
    location: "Hanoi",
    linkedin: "linkedin.com/in/lan",
  },
  summary: "Ships small experiments.",
  experience: [
    {
      role: "Discovery lead",
      company: "UIT Product Club",
      period: "2024 – Present",
      bullets: ["Ran interviews"],
    },
  ],
  education: [
    {
      school: "UIT",
      degree: "B.Sc. Information Systems",
      period: "2022 – 2026",
      detail: "HCI",
    },
  ],
  skills: [{ label: "Product", items: ["Interviews", "PRDs"] }],
}

const pages: PaperPages = {
  docId: "doc-1",
  pages: 1,
  pageChoice: "unset",
}

function view(document: PaperView["document"]): PaperView {
  return {
    id: "doc-1",
    name: "Lan CV",
    kind: "cv",
    templateId: "simple",
    status: "draft",
    document,
    contentVersion: 1,
    checks: [],
    pageChoice: "unset",
    sourceFileId: null,
    createdAt: "2020-01-01T00:00:00.000Z",
    updatedAt: "2020-01-01T00:00:00.000Z",
  }
}

function visibleText(surface: "editor" | "share") {
  const read = (name: string) =>
    screen.getAllByRole("textbox", { name }).map((node) => node.textContent)
  return {
    name: read("Name"),
    headline: read("Headline"),
    summary: read("Summary"),
    role: read("Role"),
    company: read("Company"),
    period: read("Period"),
    bullet: read("Bullet point"),
    school: read("School"),
    degree: read("Degree"),
    detail: read("Education detail"),
    skill: read("Skill"),
    contact:
      surface === "editor"
        ? {
            email: read("Email"),
            phone: read("Phone"),
            city: read("City"),
            linkedin: read("LinkedIn"),
          }
        : read("Contact detail"),
  }
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  state.pathname = "/share/tok"
})

describe("version 2 preview", () => {
  it("renders a version 2 CV and a v1 CV with the same editor text", () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(Response.json({ ok: true, data: {} }))
    )
    const v1 = render(
      <PaperCvEditor
        initial={view(fixture)}
        pages={pages}
        onBack={() => undefined}
      />
    )
    const fromV1 = visibleText("editor")
    v1.unmount()

    render(
      <PaperCvEditor
        initial={view(cvCodecToBlocks(fixture))}
        pages={pages}
        onBack={() => undefined}
      />
    )
    expect(visibleText("editor")).toEqual(fromV1)
    expect(fromV1.role).toEqual(["Discovery lead"])
    expect(fromV1.period).toContain("2024 – Present")
    expect(fromV1.bullet).toEqual(["Ran interviews"])
    expect(fromV1.school).toEqual(["UIT"])
    expect(fromV1.skill).toEqual(["Interviews", "PRDs"])
  })

  it("renders a version 2 CV and a v1 CV with the same share text", async () => {
    const documents = [fixture, cvCodecToBlocks(fixture)]
    const seen: ReturnType<typeof visibleText>[] = []
    for (const document of documents) {
      cleanup()
      vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes("/api/paper/shared/tok")) {
          return Promise.resolve(
            Response.json({ ok: true, data: view(document) })
          )
        }
        return Promise.resolve(Response.json({ ok: true, data: {} }))
      })
      render(<PaperSharePage />)
      expect(
        await screen.findByRole("heading", { name: "Lan CV" })
      ).toBeInTheDocument()
      seen.push(visibleText("share"))
    }
    expect(seen[1]).toEqual(seen[0])
    expect(seen[0]?.role).toEqual(["Discovery lead"])
    expect(seen[0]?.school).toEqual(["UIT"])
    expect(seen[0]?.skill).toEqual(["Interviews", "PRDs"])
  })

  it("draws activities and awards on every share layout", async () => {
    const blocks = cvCodecToBlocks(fixture)
    blocks.sections.push(
      {
        id: "sec-act",
        kind: "activities",
        blocks: [{ id: "act-1", type: "text", text: "Debate club" }],
      },
      {
        id: "sec-aw",
        kind: "awards",
        blocks: [{ id: "aw-1", type: "text", text: "Dean list" }],
      }
    )
    const layouts = [
      "simple",
      "modern",
      "compact",
      "academic",
      "with-photo",
    ] as const
    for (const templateId of layouts) {
      cleanup()
      vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes("/api/paper/shared/tok")) {
          return Promise.resolve(
            Response.json({
              ok: true,
              data: { ...view(blocks), templateId },
            })
          )
        }
        return Promise.resolve(Response.json({ ok: true, data: {} }))
      })
      render(<PaperSharePage />)
      expect(
        await screen.findByRole("heading", { name: "Lan CV" })
      ).toBeInTheDocument()
      expect(screen.getByText("Debate club")).toBeInTheDocument()
      expect(screen.getByText("Dean list")).toBeInTheDocument()
      expect(
        screen.getByRole("heading", { name: "Activities" })
      ).toBeInTheDocument()
      expect(
        screen.getByRole("heading", { name: "Awards" })
      ).toBeInTheDocument()
    }
  })
})
