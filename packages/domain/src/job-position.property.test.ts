import assert from "node:assert/strict"
import { describe, it } from "node:test"

import fc from "fast-check"

import { generateKeyBetween } from "./job-position.ts"

type Step = { at: number; side: "before" | "after" | "between" }

const steps = fc.array(
  fc.record({
    at: fc.nat(1000),
    side: fc.constantFrom<Step["side"]>("before", "after", "between"),
  }),
  { maxLength: 80 }
)

function insertAll(plan: Step[]) {
  const keys: string[] = []
  for (const { at, side } of plan) {
    if (keys.length === 0) {
      keys.push(generateKeyBetween(null, null))
      continue
    }
    const index = at % keys.length
    if (side === "before") {
      keys.splice(
        index,
        0,
        generateKeyBetween(keys[index - 1] ?? null, keys[index])
      )
    } else if (side === "after") {
      keys.splice(
        index + 1,
        0,
        generateKeyBetween(keys[index], keys[index + 1] ?? null)
      )
    } else {
      const left = Math.max(index - 1, 0)
      keys.splice(
        left + 1,
        0,
        generateKeyBetween(keys[left], keys[left + 1] ?? null)
      )
    }
  }
  return keys
}

describe("generateKeyBetween properties", () => {
  it("every key it makes sorts strictly between its neighbours", () => {
    fc.assert(
      fc.property(steps, (plan) => {
        const keys = insertAll(plan)
        for (let i = 1; i < keys.length; i += 1) {
          assert.ok(keys[i - 1]! < keys[i]!, `${keys[i - 1]} then ${keys[i]}`)
        }
      }),
      { numRuns: 500 }
    )
  })

  it("repeated inserts at one spot never repeat a key", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("front", "back", "gap"),
        fc.integer({ min: 1, max: 120 }),
        (spot, count) => {
          const keys = [generateKeyBetween(null, null)]
          if (spot === "gap") keys.push(generateKeyBetween(keys[0]!, null))
          for (let i = 0; i < count; i += 1) {
            if (spot === "front")
              keys.unshift(generateKeyBetween(null, keys[0]))
            else if (spot === "back")
              keys.push(generateKeyBetween(keys.at(-1), null))
            else keys.splice(1, 0, generateKeyBetween(keys[0], keys[1]))
          }
          assert.equal(new Set(keys).size, keys.length)
          assert.deepEqual(keys, [...keys].sort())
        }
      ),
      { numRuns: 100 }
    )
  })

  it("refuses equal and inverted bounds instead of looping or repeating a key", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(..."0123456789ABCxyz"), {
          minLength: 1,
          maxLength: 6,
        }),
        (chars) => {
          const key = chars.join("")
          assert.throws(() => generateKeyBetween(key, key), RangeError)
        }
      )
    )
    assert.throws(() => generateKeyBetween("b", "a"), RangeError)
  })
})
