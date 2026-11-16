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
]

describe("Proofs stays under Paper", () => {
  it("does not add a Proofs sidebar row", () => {
    expect(SHELL_WORK.map((item) => item.id)).toEqual([
      "paper",
      "apply",
      "pitch",
    ])
    expect(SURFACES.find((surface) => surface.id === "proofs")?.nav).toBeNull()
    expect(SURFACES.find((surface) => surface.id === "proofs")?.inSearch).toBe(
      true
    )
  })

  it("highlights Paper on /proofs and /proof", () => {
    expect(currentNavPath("/proofs", targets)).toBe(SURFACE_PATHS.paper)
    expect(currentNavPath("/proof", targets)).toBe(SURFACE_PATHS.paper)
    expect(currentNavPath("/proofs/later", targets)).toBe(SURFACE_PATHS.paper)
    expect(currentNavPath("/apply", targets)).toBe(SURFACE_PATHS.apply)
    expect(currentNavPath("/paper/doc", targets)).toBe(SURFACE_PATHS.paper)
  })
})
