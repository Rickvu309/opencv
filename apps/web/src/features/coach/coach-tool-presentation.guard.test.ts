import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

function detectUnsafeToolPresentation(source: string) {
  return [
    ["technical command arguments", /args:\s*\{\s*command:\s*tool\.name/],
    ["running approval", /status:\s*needsApproval\s*\?\s*"running"/],
    ["code block for prose", /<CodeBlock\b/],
  ].flatMap(([name, pattern]) =>
    pattern instanceof RegExp && pattern.test(source) ? [name] : []
  )
}

describe("Coach presentation guard", () => {
  it("detects each original mistake", () => {
    expect(
      detectUnsafeToolPresentation("args: { command: tool.name }")
    ).toEqual(["technical command arguments"])
    expect(
      detectUnsafeToolPresentation(
        'status: needsApproval ? "running" : "success"'
      )
    ).toEqual(["running approval"])
    expect(detectUnsafeToolPresentation("<CodeBlock code={text} />")).toEqual([
      "code block for prose",
    ])
  })

  it("accepts human labels, an awaiting state and prose diff markup", () => {
    expect(
      detectUnsafeToolPresentation(
        'name: coachToolLabel(tool.name), status: needsApproval ? "awaiting" : "success", diff: <ins>{text}</ins>'
      )
    ).toEqual([])
  })

  it("keeps the owning presentation files free of these mistakes", () => {
    for (const name of ["coach-tool-line.tsx", "rich-receipts.tsx"]) {
      expect(
        detectUnsafeToolPresentation(
          readFileSync(new URL(name, import.meta.url), "utf8")
        )
      ).toEqual([])
    }
  })
})
