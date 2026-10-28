import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, screen } from "@testing-library/react"
import type { ReactElement } from "react"
import type { PaperPages, PaperView } from "@workspace/domain"

import { ChatStoreProvider } from "@/features/coach/chat-store.tsx"
import { render as renderWithClient } from "@/test/render-with-client.tsx"

import { PaperCvEditor } from "./paper-editor.tsx"

function render(ui: ReactElement) {
  return renderWithClient(<ChatStoreProvider>{ui}</ChatStoreProvider>)
}

const record: PaperView = {
  id: "doc-1",
  name: "PM track CV",
  kind: "cv",
  templateId: "simple",
  status: "draft",
  document: {
    version: 2,
    header: { name: "Ada", email: "", phone: "", city: "", linkedin: "" },
    sections: [
      {
        id: "section-experience",
        kind: "experience",
        blocks: [
          {
            id: "exp-a",
            type: "experience-entry",
            role: "First role",
            company: "Northwind",
            period: "",
            bullets: [],
          },
          {
            id: "exp-b",
            type: "experience-entry",
            role: "Second role",
            company: "Contoso",
            period: "",
            bullets: [],
          },
        ],
      },
      {
        id: "section-education",
        kind: "education",
        blocks: [
          {
            id: "edu-1",
            type: "education-entry",
            school: "State",
            degree: "BSc",
            period: "",
            detail: "Honors",
          },
        ],
      },
      {
        id: "section-skills",
        kind: "skills",
        blocks: [
          {
            id: "skill-1",
            type: "skills-group",
            label: "Tools",
            items: ["TypeScript"],
          },
        ],
      },
    ],
  },
  contentVersion: 1,
  checks: [],
  pageChoice: "unset",
  sourceFileId: null,
  createdAt: "2020-01-01T00:00:00.000Z",
  updatedAt: "2020-01-01T00:00:00.000Z",
}

const pages: PaperPages = { docId: record.id, pages: 1, pageChoice: "unset" }

function ok(data: unknown) {
  return Response.json({ ok: true, data })
}

const originalRect = HTMLElement.prototype.getBoundingClientRect

afterEach(() => {
  HTMLElement.prototype.getBoundingClientRect = originalRect
  cleanup()
  vi.unstubAllGlobals()
})

function box(top: number, height: number, width = 240): DOMRect {
  return {
    x: 0,
    y: top,
    left: 0,
    top,
    right: width,
    bottom: top + height,
    width,
    height,
    toJSON() {
      return {}
    },
  } as DOMRect
}

async function key(target: EventTarget, code: string) {
  await act(async () => {
    fireEvent.keyDown(target, { code, key: code === "Space" ? " " : code })
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

describe("drop on a section heading", () => {
  it("saves one append and keeps the other blocks", async () => {
    HTMLElement.prototype.getBoundingClientRect = function () {
      const id = this.getAttribute("data-sortable-block")
      const kind = this.parentElement?.getAttribute("data-section")
      if (id === "exp-a") return box(40, 36)
      if (id === "exp-b") return box(90, 36)
      if (id === "edu-1") return box(200, 48)
      if (id === "skill-1") return box(300, 36)
      if (this.tagName === "H2" && kind === "experience") return box(0, 24)
      if (this.tagName === "H2" && kind === "education") return box(150, 24)
      if (this.tagName === "H2" && kind === "skills") return box(260, 24)
      return box(0, 4000, 1440)
    }
    const bodies: {
      input?: {
        document?: { sections?: { id: string; blocks?: { id: string }[] }[] }
      }
    }[] = []
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes("/api/commands/paper.replace")) {
        bodies.push(JSON.parse(String(init?.body)) as (typeof bodies)[number])
        return Promise.resolve(ok({ ...record, contentVersion: 2 }))
      }
      return Promise.resolve(ok({}))
    })
    render(
      <PaperCvEditor initial={record} pages={pages} onBack={() => undefined} />
    )
    const handle = screen.getAllByRole("button", { name: "Block menu" })[1]!
    handle.focus()
    await key(handle, "Space")
    await key(document, "ArrowDown")
    await key(document, "Space")
    expect(bodies).toHaveLength(1)
    expect(
      bodies[0]?.input?.document?.sections?.map((section) =>
        section.blocks?.map((block) => block.id)
      )
    ).toEqual([["exp-a"], ["edu-1", "exp-b"], ["skill-1"]])
  })
})
