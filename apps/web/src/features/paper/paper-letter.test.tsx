import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, screen } from "@testing-library/react"
import type { PaperClient } from "@workspace/paper-crdt"

import { render } from "@/test/render-with-client.tsx"
import { paragraph, seededLetterClient } from "@/test/paper-fixture.ts"
import { installFetch, job, letter, ok } from "@/test/paper-letter-kit.tsx"

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
    fireEvent.click(screen.getByRole("button", { name: "Copy share link" }))
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
