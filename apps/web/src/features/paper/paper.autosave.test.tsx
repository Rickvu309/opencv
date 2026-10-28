import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, screen, within } from "@testing-library/react"

import { SURFACE_PATHS } from "@/lib/product-paths.ts"
import { getMockPaperDocs } from "@/test/paper-api-mock.ts"
import { expectPaperDrive } from "@/test/paper-drive.ts"
import { renderApp } from "@/test/render-app.tsx"

afterEach(() => {
  vi.useRealTimers()
  cleanup()
  localStorage.clear()
})

function savedSummary() {
  const cv = getMockPaperDocs().find((doc) => doc.name === "PM track CV")
  const content = cv?.content as
    | {
        summary?: string
        sections?: {
          kind?: string
          blocks?: { type?: string; text?: string }[]
        }[]
      }
    | undefined
  const text = content?.sections
    ?.find((section) => section.kind === "summary")
    ?.blocks?.find((block) => block.type === "text")?.text
  return text ?? content?.summary
}

async function openCv() {
  await expectPaperDrive()
  fireEvent.click(screen.getByRole("button", { name: /^PM track CV,/ }))
  const editor = await screen.findByRole("region", {
    name: "Editing PM track CV",
  })
  return within(editor).getByRole("textbox", { name: "Summary" })
}

function typeSummary(summary: HTMLElement, text: string) {
  summary.textContent = text
  fireEvent.input(summary)
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

describe("Paper autosave timing", () => {
  it("saves 700 ms after the last edit and restarts the wait on each edit", async () => {
    renderApp(SURFACE_PATHS.paper)
    const summary = await openCv()
    const before = savedSummary()

    vi.useFakeTimers()
    typeSummary(summary, "first burst")
    await advance(400)
    typeSummary(summary, "first burst, second burst")
    await advance(400)
    expect(savedSummary()).toBe(before)

    await advance(299)
    expect(savedSummary()).toBe(before)
    await advance(1)
    expect(savedSummary()).toBe("first burst, second burst")
  })

  it("flushes a pending edit when the editor unmounts before the timer", async () => {
    const view = renderApp(SURFACE_PATHS.paper)
    const summary = await openCv()

    vi.useFakeTimers()
    typeSummary(summary, "flush me")
    view.unmount()
    await advance(0)

    expect(savedSummary()).toBe("flush me")
  })
})
