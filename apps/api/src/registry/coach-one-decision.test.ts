import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const source = readFileSync(new URL("./registry.ts", import.meta.url), "utf8")

function method(name: string) {
  const start = source.indexOf(`async ${name}(`)
  const next = source.indexOf("\n  async ", start + 1)
  return source.slice(start, next === -1 ? source.length : next)
}

describe("coachRefusal is the one decision on whether a Coach actor may use an entry", () => {
  it("tools, execute and read ask it, and approve reaches it through execute", () => {
    expect(method("tools")).toContain("coachRefusal(")
    expect(method("execute")).toContain("coachRefusal(")
    expect(method("read")).toContain("coachRefusal(")
    expect(method("approve")).toContain("this.execute(")
    expect(method("approve")).not.toContain("coachRefusal(")
    const policy = readFileSync(
      new URL("./coach-policy.ts", import.meta.url),
      "utf8"
    )
    expect(source).toContain('from "./coach-policy.js"')
    expect(policy.match(/export function coachRefusal\(/g)).toHaveLength(1)
    expect((source + policy).match(/coachRefusal\(/g)).toHaveLength(5)
  })
})
