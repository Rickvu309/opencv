import { StrictMode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, screen } from "@testing-library/react"
import type { PaperClient } from "@workspace/paper-crdt"

import { render } from "@/test/render-with-client.tsx"
import { paragraph, seededLetterClient } from "@/test/paper-fixture.ts"
import { job, letter, ok } from "@/test/paper-letter-kit.tsx"

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

describe("Cover letter print", () => {
  it("prints the letter from Download PDF", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(ok({})))
    const print = vi.spyOn(window, "print").mockImplementation(() => {
      expect(document.body).toHaveAttribute("data-print", "paper")
      const sheet = document.querySelector("[data-paper-letter]")
      expect(sheet?.textContent).toContain("I write clearly.")
      window.dispatchEvent(new Event("afterprint"))
    })
    render(
      <PaperLetterEditor
        doc={letter}
        job={job}

        onBack={() => undefined}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: "More" }))
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Download PDF" })
    )
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(print).toHaveBeenCalledTimes(1)
  })

  it("prints once in strict mode and unmounts the letter sheet", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(ok({})))
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined)
    render(
      <StrictMode>
        <PaperLetterEditor
          doc={letter}
          job={job}

          onBack={() => undefined}
        />
      </StrictMode>
    )
    fireEvent.click(screen.getByRole("button", { name: "More" }))
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Download PDF" })
    )
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30))
    })
    expect(print).toHaveBeenCalledTimes(1)
    expect(document.querySelector("[data-paper-letter]")).not.toBeNull()
    act(() => {
      window.dispatchEvent(new Event("afterprint"))
    })
    expect(document.querySelector("[data-paper-letter]")).toBeNull()
  })
})
