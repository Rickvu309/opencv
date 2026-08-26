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

    const hook = read("features/coach/use-coach-turn.ts")
    expect(hook).toMatch(/export function useCoachTurn/)
    expect(hook).toMatch(/getThreadByFocusDoc/)
    expect(hook).toMatch(/focusDocId/)
    expect(hook).not.toMatch(/sessionStorage/)
    expect(hook).not.toMatch(/paperCoachThreadStorageKey/)

    const store = read("features/home/thread-store.tsx")
    expect(store).toMatch(/useCoachTurn/)
    expect(store).not.toMatch(/streamCoachTurn/)

    const panel = read("features/paper/coach-thread-panel.tsx")
    expect(panel).toMatch(/useCoachTurn/)
    expect(panel).toMatch(/CoachDock/)
    expect(panel).toMatch(/showModePicker=\{false\}/)
    expect(panel).not.toMatch(/sessionStorage/)
    expect(panel).not.toMatch(/Sparkles/)
    expect(panel).not.toMatch(/AI assist/)
  })
})
