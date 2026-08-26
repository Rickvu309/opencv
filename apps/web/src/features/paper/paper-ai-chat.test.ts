import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))

describe("Paper Coach thread binding", () => {
  it("does not keep a sessionStorage doc-to-thread map", () => {
    const src = readFileSync(path.join(here, "use-paper-coach.ts"), "utf8")
    expect(src).not.toMatch(/sessionStorage/)
    expect(src).not.toMatch(/paperCoachThreadStorageKey/)
    expect(src).toMatch(/getThreadByFocusDoc/)
    expect(src).toMatch(/focusDocId: docId/)
  })
})
