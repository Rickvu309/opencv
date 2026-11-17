import { blankCv } from "@workspace/domain"
import {
  SERVER_ORIGIN,
  writeDocument,
  type PaperClient,
} from "@workspace/paper-crdt"
import { act, cleanup, fireEvent, screen } from "@testing-library/react"
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"
import * as Y from "yjs"

import { installEditorPolyfills } from "@/test/paper-engine-kit.tsx"
import {
  paragraph,
  seededCvClient,
  seededLetterClient,
} from "@/test/paper-fixture.ts"
import { installFetch, job, letter, ok } from "@/test/paper-letter-kit.tsx"
import { render } from "@/test/render-with-client.tsx"

import { cvEditorStatus } from "./paper-cv-bar.tsx"
import { PaperCvEditor } from "./paper-cv-editor.tsx"
import {
  pages,
  record,
  render as renderCvEditor,
} from "./paper-editor.fixtures.tsx"
import { PaperLetterEditor } from "./paper-letter.tsx"

const fixture = vi.hoisted(() => ({ client: null as PaperClient | null }))

vi.mock("@/lib/paper-sync.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paper-sync.ts")>()),
  usePaperSync: () => ({
    sync: null,
    status: "saved" as const,
    generation: 1,
    client: fixture.client,
  }),
}))

beforeAll(() => {
  installEditorPolyfills()
})

beforeEach(() => {
  fixture.client = seededLetterClient([paragraph("p1", "I write clearly.")])
})

afterEach(() => {
  document.body.removeAttribute("data-print")
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("Cover letter editor", () => {
  it("does not claim a CV source in the saved letter editor", () => {
    installFetch("tool")
    render(
      <PaperLetterEditor doc={letter} job={job} onBack={() => undefined} />
    )
    expect(screen.queryByText(/^From/)).not.toBeInTheDocument()
    expect(screen.getByText("I write clearly.")).toBeInTheDocument()
  })

  it("keeps Download PDF in the More menu and not in the header", () => {
    vi.stubGlobal("fetch", () => Promise.resolve(ok({})))
    render(
      <PaperLetterEditor doc={letter} job={job} onBack={() => undefined} />
    )
    expect(
      screen.queryByRole("button", { name: "Download PDF" })
    ).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "More" })).toBeInTheDocument()
  })

  it("copies the share link from the link button and says so", async () => {
    const calls: string[] = []
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      calls.push(String(input))
      return Promise.resolve(ok({ token: "tok-123" }))
    })
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    })
    render(
      <PaperLetterEditor doc={letter} job={job} onBack={() => undefined} />
    )
    const copy = screen.getByRole("button", { name: "Copy share link" })
    expect(copy.className).toContain("size-11")
    expect(copy.className).toContain("md:h-7")
    expect(copy.className).toContain("md:w-[30px]")
    fireEvent.click(copy)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(calls.some((url) => url.includes("paper.share"))).toBe(true)
    expect(writeText).toHaveBeenCalledTimes(1)
    expect(String((writeText.mock.calls[0] as unknown[])[0])).toContain(
      "tok-123"
    )
  })

  it("offers Add to letter for a Meta Ads gap and Skip closes the card", () => {
    render(
      <PaperLetterEditor
        doc={letter}
        job={job}

        onBack={() => undefined}
      />
    )
    expect(screen.getByText(/The job asks for Meta/)).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Add to letter" })
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Skip" }))
    expect(
      screen.queryByRole("button", { name: "Add to letter" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Skip" })
    ).not.toBeInTheDocument()
  })
})

describe("CV editor on the paper route", () => {
  it("sends typing through the sync client and keeps a Coach edit beside it", async () => {
    const base = blankCv()
    const client = seededCvClient({
      ...base,
      blocks: [
        base.blocks[0],
        {
          id: "job-1",
          type: "experience",
          role: "",
          company: "",
          period: "",
          location: "",
          children: [],
        },
        ...base.blocks.slice(1),
      ],
    })
    fixture.client = client
    renderCvEditor(
      <PaperCvEditor
        initial={record}
        pages={pages(1)}
        onBack={() => undefined}
      />
    )
    await act(async () => {
      await Promise.resolve()
    })
    const beforeTyping = client.document()
    if (!beforeTyping || beforeTyping.kind !== "cv")
      throw new Error("missing cv")
    const before = Y.encodeStateAsUpdate(client.ydoc)
    const name = screen.getByRole("textbox", { name: "Full name" })
    name.focus()
    fireEvent.input(name, { target: { value: "Nia" } })
    expect(JSON.stringify(client.document())).toContain("Nia")
    expect(client.hasPending()).toBe(true)
    const prepared = client.prepare()
    expect(prepared.update.byteLength).toBeGreaterThan(0)
    act(() => {
      const remote = new Y.Doc()
      Y.applyUpdate(remote, before)
      writeDocument(
        remote,
        {
          ...beforeTyping,
          header: { ...beforeTyping.header, email: "coach@example.com" },
        },
        "coach"
      )
      Y.applyUpdate(client.ydoc, Y.encodeStateAsUpdate(remote), SERVER_ORIGIN)
    })
    const email = screen.getByRole("textbox", {
      name: "Email",
    }) as HTMLInputElement
    expect((name as HTMLInputElement).value).toBe("Nia")
    expect(email.value).toBe("coach@example.com")
    expect(document.activeElement).toBe(name)
    const text = JSON.stringify(client.document())
    expect(text).toContain("Nia")
    expect(text).toContain("coach@example.com")
    const role = screen.getByRole("textbox", {
      name: "Role",
    }) as HTMLInputElement
    role.focus()
    expect(role.value).toBe("")
    act(() => {
      const current = client.document()
      if (!current || current.kind !== "cv") throw new Error("missing cv")
      writeDocument(
        client.ydoc,
        {
          ...current,
          blocks: current.blocks.map((block) =>
            block.id === "job-1" && block.type === "experience"
              ? { ...block, role: "Senior engineer" }
              : block
          ),
        },
        SERVER_ORIGIN
      )
    })
    expect(role.value).toBe("Senior engineer")
    fireEvent.blur(role)
    expect(role.value).toBe("Senior engineer")
    expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Download PDF" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Coach" })).toBeTruthy()
    expect(
      document.querySelector(".bn-editor")?.getAttribute("aria-label")
    ).toContain("CV")
    const iso = new Date().toISOString()
    expect(cvEditorStatus("saving", iso, true)).not.toBe("Saving")
    expect(cvEditorStatus("saving", iso, false)).toBe("Saving")
  })
})
