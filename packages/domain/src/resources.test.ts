import assert from "node:assert/strict"
import { it } from "node:test"
import { effectiveCoachPolicy, jobPriorityResource } from "./resources.ts"

it("uses the strictest policy from the command and its input's resources", () => {
  const writes = (priority: boolean) => (priority ? [jobPriorityResource] : [])
  assert.equal(effectiveCoachPolicy({ coach: "auto", writes }, true), "confirm")
  assert.equal(effectiveCoachPolicy({ coach: "auto", writes }, false), "auto")
  assert.equal(effectiveCoachPolicy({ coach: "never", writes }, true), "never")
  assert.equal(effectiveCoachPolicy({ coach: "confirm" }, {}), "confirm")
  assert.equal(
    effectiveCoachPolicy(
      {
        coach: "auto",
        writes: () => [{ name: "private", coachFloor: "never" }],
      },
      {}
    ),
    "never"
  )
})
