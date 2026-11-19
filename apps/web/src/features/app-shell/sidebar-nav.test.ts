import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { SURFACE_PATHS, SURFACES } from "@/lib/product-paths.ts"

import { currentNavPath, SHELL_WORK } from "./sidebar-nav.ts"

const targets = [
  SURFACE_PATHS.inbox,
  SURFACE_PATHS.coach,
  SURFACE_PATHS.jobs,
  SURFACE_PATHS.paper,
  SURFACE_PATHS.apply,
  SURFACE_PATHS.pitch,
  SURFACE_PATHS.proofs,
]

describe("Proofs is a sidebar row in Your work", () => {
  it("lists Proofs after Pitch and keeps it in search", () => {
    expect(SHELL_WORK.map((item) => item.id)).toEqual([
      "paper",
      "apply",
      "pitch",
      "proofs",
    ])
    expect(SURFACES.find((surface) => surface.id === "proofs")?.inSearch).toBe(
      true
    )
  })

  it("highlights Proofs on /proofs and on one proof", () => {
    expect(currentNavPath("/proofs", targets)).toBe(SURFACE_PATHS.proofs)
    expect(currentNavPath("/proof", targets)).toBe(SURFACE_PATHS.proofs)
    expect(currentNavPath("/proofs/later", targets)).toBe(SURFACE_PATHS.proofs)
    expect(currentNavPath("/proof/later", targets)).toBe(SURFACE_PATHS.proofs)
    expect(currentNavPath("/proofing", targets)).toBeNull()
    expect(currentNavPath("/apply", targets)).toBe(SURFACE_PATHS.apply)
    expect(currentNavPath("/paper/doc", targets)).toBe(SURFACE_PATHS.paper)
  })

  it("reads the parent from the surface row", () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "sidebar-nav.ts"),
      "utf8"
    )
    expect(source).not.toMatch(/\\\/proofs\?/)
    const proof = SURFACES.find((surface) => surface.id === "proof")
    expect(proof && "navParent" in proof && proof.navParent).toBe("proofs")
  })
})
