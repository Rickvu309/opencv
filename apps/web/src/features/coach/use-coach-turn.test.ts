import { describe, expect, it } from "vitest"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const webSrc = path.join(here, "../..")

function read(rel: string) {
  return readFileSync(path.join(webSrc, rel), "utf8")
}

describe("shared Coach turn hook", () => {
  it("is the only turn implementation; Paper no longer has a private coach hook", () => {
    expect(existsSync(path.join(webSrc, "features/paper/use-paper-coach.ts"))).toBe(
      false
    )
    expect(existsSync(path.join(webSrc, "features/paper/paper-ai-chat.tsx"))).toBe(
      false
    )
    expect(
      existsSync(path.join(webSrc, "features/paper/coach-thread-panel.tsx"))
    ).toBe(false)

    const hook = read("features/coach/use-coach-turn.ts")
    expect(hook).toMatch(/export function useCoachTurn/)
    expect(hook).toMatch(/getThreadByFocusDoc/)
    expect(hook).toMatch(/focusDocId/)
    expect(hook).not.toMatch(/sessionStorage/)
    expect(hook).not.toMatch(/paperCoachThreadStorageKey/)

    const store = read("features/home/thread-store.tsx")
    expect(store).toMatch(/useCoachTurn/)
    expect(store).not.toMatch(/streamCoachTurn/)

    const panel = read("features/paper/coach-float.tsx")
    expect(panel).toMatch(/useCoachTurn/)
    expect(panel).toMatch(/useCoachExternalRuntime/)
    expect(panel).toMatch(/CoachThread/)
    expect(panel).toMatch(/data-coach-soft-scope/)
    expect(panel).toMatch(/data-coach-context-chip/)
    expect(panel).toMatch(/Add to context/)
    expect(panel).toMatch(/Pin in context/)
    expect(panel).toMatch(/Attached from Paper/)
    expect(panel).toMatch(/Remove from context/)
    expect(panel).toMatch(/PaperCiteControl/)
    expect(panel).not.toMatch(/provenance/)
    expect(panel).not.toMatch(/sources rail/)
    const cite = read("features/paper/paper-cite-control.tsx")
    expect(cite).toMatch(/data-coach-cite/)
    expect(cite).toMatch(/Show on Paper/)
    expect(cite).not.toMatch(/provenance/)
    expect(cite).not.toMatch(/sources rail/)
    expect(cite).not.toMatch(/knowledge-base/)
    expect(panel).not.toMatch(/ThreadView/)
    expect(read("features/coach/coach-thread.tsx")).toMatch(/CoachDock/)
    expect(read("features/coach/coach-thread.tsx")).toMatch(
      /showModePicker=\{false\}/
    )
    expect(read("features/coach/coach-thread.tsx")).toMatch(/onAttachFromPaper/)
    expect(read("features/coach/coach-thread.tsx")).toMatch(/messageCite/)
    expect(read("features/coach/coach-thread.tsx")).not.toMatch(/provenance/)
    expect(read("features/coach/coach-thread.tsx")).not.toMatch(/sources rail/)
    expect(read("features/coach/coach-dock.tsx")).toMatch(/onAttachFromPaper/)
    expect(panel).not.toMatch(/sessionStorage/)
    expect(panel).not.toMatch(/Sparkles/)
    expect(panel).not.toMatch(/AI assist/)
    expect(panel).not.toMatch(/knowledge-base/)
    expect(panel).not.toMatch(/Add sources/)
    expect(panel).not.toMatch(/sources library/)
  })
})
