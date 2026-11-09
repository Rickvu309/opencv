import { describe, expect, it } from "vitest"

import {
  renderMap,
  RenderMapRefusal,
  type AcknowledgedRevision,
} from "./package-render-map.js"

const revision = "11111111-1111-4111-8111-111111111111"
const otherRevision = "22222222-2222-4222-8222-222222222222"
const profile = "paper-safe-surface-one-run-unique-span-2"
const first = `t_${"a".repeat(64)}`
const second = `t_${"b".repeat(64)}`

function surface(targets: readonly string[] = [first]): AcknowledgedRevision {
  return { revision, profile, targets }
}

function code(run: () => unknown) {
  try {
    run()
  } catch (error) {
    expect(error).toBeInstanceOf(RenderMapRefusal)
    return (error as RenderMapRefusal).code
  }
  throw new Error("expected a refusal")
}

describe("revision map", () => {
  it("is built from one acknowledged revision and that revision's profile", () => {
    const targets = [first, second]
    const map = renderMap(surface(targets))
    targets.push(`t_${"c".repeat(64)}`)
    expect(map).toEqual({ revision, profile, targets: [first, second] })
    expect(renderMap(surface())).toEqual(renderMap(surface()))
    expect(Object.keys(map)).toEqual(["revision", "profile", "targets"])
    expect(Object.isFrozen(map.targets)).toBe(true)
  })

  it("keeps a second revision on its own map", () => {
    const map = renderMap(surface([first]))
    const other = renderMap({
      revision: otherRevision,
      profile: "other-profile",
      targets: [second],
    })
    expect(other.revision).toBe(otherRevision)
    expect(other.profile).toBe("other-profile")
    expect(other.targets).toEqual([second])
    expect(map.targets).not.toContain(second)
    expect(other.targets).not.toContain(first)
  })

  it("refuses a target that is not already an opaque id", () => {
    expect(code(() => renderMap(surface(["paragraph-1"])))).toBe("new-target")
    expect(code(() => renderMap(surface([`t_${"a".repeat(63)}`])))).toBe(
      "new-target"
    )
    expect(code(() => renderMap(surface([first.toUpperCase()])))).toBe(
      "new-target"
    )
  })

  it("refuses an empty revision, an empty profile, or a repeated target", () => {
    expect(
      code(() => renderMap({ revision: "", profile, targets: [first] }))
    ).toBe("empty-revision")
    expect(
      code(() => renderMap({ revision, profile: "", targets: [first] }))
    ).toBe("empty-profile")
    expect(code(() => renderMap(surface([first, first])))).toBe(
      "duplicate-target"
    )
  })

  it("refuses an offset or a second map on the acknowledged revision", () => {
    expect(
      code(() => renderMap({ ...surface(), offset: 4 } as AcknowledgedRevision))
    ).toBe("offset")
    expect(
      code(() =>
        renderMap({
          ...surface(),
          maps: [],
        } as AcknowledgedRevision)
      )
    ).toBe("second-map")
  })
})
