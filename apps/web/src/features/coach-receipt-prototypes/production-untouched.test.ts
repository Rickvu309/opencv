// @vitest-environment node
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const webRoot = fileURLToPath(new URL("../..", import.meta.url))

describe("production receipt renderer stays generic", () => {
  it("does not add per-command branches to the live Thread receipt", () => {
    const threadView = readFileSync(
      path.join(webRoot, "features/home/thread-view.tsx"),
      "utf8"
    )
    const headline = readFileSync(
      path.join(webRoot, "features/home/coach-receipt.ts"),
      "utf8"
    )

    expect(threadView).toMatch(/function CoachReceipt/)
    expect(threadView).toMatch(/receiptHeadline\(part\)/)
    expect(threadView).not.toMatch(
      /paper\.updateContent|apply\.moveCard|paper\.createDoc/
    )
    expect(headline).toMatch(/Ran \$\{commandNameFromTool/)
    expect(headline).not.toMatch(/switch/)
  })
})
