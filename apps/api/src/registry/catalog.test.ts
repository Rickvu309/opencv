import { describe, expect, it } from "vitest"
import { catalog, catalogDigest } from "@workspace/domain"

import { implementations } from "./catalog.js"
import { installRegistry } from "./install.js"

describe("the discovered catalog is an uninstalled bridge during preparation", () => {
  it("has no production operations and leaves legacy installation unchanged", () => {
    const registry = installRegistry()
    expect(Object.keys(catalog)).toEqual([])
    expect(Object.keys(implementations)).toEqual([])
    expect(catalogDigest).toMatch(/^[a-f0-9]{64}$/)
    expect(installRegistry()).toBe(registry)
    expect(registry.commandNames()).toContain("job.setPriority")
  })
})
