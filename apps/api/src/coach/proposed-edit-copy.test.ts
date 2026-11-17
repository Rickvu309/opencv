import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import { FAKE_PROPOSED_EDIT_TEXT } from "./fake.js"

describe("scripted Coach edit copy", () => {
  it("says the edit is a proposal in both fake runtimes", () => {
    expect(FAKE_PROPOSED_EDIT_TEXT).toBe("I proposed one edit.")
    const fake = readFileSync(new URL("./fake.ts", import.meta.url), "utf8")
    const runtime = readFileSync(
      new URL("./task-runtime.ts", import.meta.url),
      "utf8"
    )
    expect(fake).toContain("FAKE_PROPOSED_EDIT_TEXT")
    expect(runtime).toContain("FAKE_PROPOSED_EDIT_TEXT")
    expect(fake).not.toContain("I made one edit")
    expect(runtime).not.toContain("I made one edit")
  })
})
