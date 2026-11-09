import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { paperReviewDiff } from "./paper-review-diff.ts"

const target = `t_${"ab".repeat(32)}`
const other = `t_${"cd".repeat(32)}`

function change(
  id: string,
  before: string,
  after: string,
  extra?: Record<string, unknown>
) {
  return {
    targetId: id,
    before,
    after,
    location: { paragraph: 1, kind: "paragraph" },
    formatting: { kind: "inherited", scope: "preserved-uncomputed" },
    context: { paragraphText: before },
    ...extra,
  }
}

function review(changes: unknown[], extra?: Record<string, unknown>) {
  return {
    docId: "6d2f0a4e-1c7b-4a1e-9b3a-6f0c1d2e3a4b",
    basedOn: "7e3a1b5f-2d8c-4b2f-8c4b-7a1d2e3f4b5c",
    changes,
    ...extra,
  }
}

const leaked = review(
  [
    change(target, "Ada", "Grace", {
      handle: "sentinel-handle",
      reversal: {
        command: "private-undo-sentinel",
        marker: "reversal-sentinel",
        nested: {
          handle: "sentinel-handle",
          packageBytes: "package-byte-sentinel",
          deeper: {
            reversal: { marker: "reversal-sentinel" },
            bytes: "package-byte-sentinel",
          },
        },
      },
      packageBytes: "package-byte-sentinel",
    }),
  ],
  {
    handle: "sentinel-handle",
    reversal: {
      marker: "reversal-sentinel",
      nested: {
        handle: "sentinel-handle",
        packageBytes: "package-byte-sentinel",
      },
    },
    packageBytes: "package-byte-sentinel",
    bytes: "package-byte-sentinel",
  }
)

function assertPublic(value: unknown): void {
  if (typeof value === "string") {
    assert.equal(value.includes("sentinel-handle"), false)
    assert.equal(value.includes("reversal-sentinel"), false)
    assert.equal(value.includes("package-byte-sentinel"), false)
    assert.equal(value.includes("private-undo-sentinel"), false)
    return
  }
  assert.equal(typeof value, "object")
  assert.notEqual(value, null)
  assert.equal(Object.isFrozen(value), true)
  if (Array.isArray(value)) {
    assert.equal(Object.getPrototypeOf(value), Array.prototype)
    const names = Object.getOwnPropertyNames(value).filter(
      (name) => name !== "length"
    )
    const indexes = []
    for (let index = 0; index < value.length; index += 1)
      indexes.push(String(index))
    assert.deepEqual(names, indexes)
    for (let index = 0; index < value.length; index += 1) {
      assert.equal(Object.hasOwn(value, index), true)
      assertPublic(value[index])
    }
    return
  }
  assert.equal(Object.getPrototypeOf(value), Object.prototype)
  assert.deepEqual(Object.getOwnPropertyNames(value).sort(), [
    "after",
    "before",
    "target",
  ])
  const row = value as Record<string, unknown>
  assertPublic(row.target)
  assertPublic(row.before)
  assertPublic(row.after)
}

describe("paperReviewDiff", () => {
  it("keeps the frozen replacements and nothing else", () => {
    const diff = paperReviewDiff(leaked)
    assert.deepEqual(diff, [{ target, before: "Ada", after: "Grace" }])
    assertPublic(diff)
    assert.deepEqual(Object.keys(diff[0] ?? {}), ["target", "before", "after"])
    const text = JSON.stringify(diff)
    assert.equal(text.includes("sentinel-handle"), false)
    assert.equal(text.includes("reversal-sentinel"), false)
    assert.equal(text.includes("package-byte-sentinel"), false)
    assert.equal(text.includes("private-undo-sentinel"), false)
    assert.equal(JSON.stringify(paperReviewDiff(leaked)), text)
    assert.throws(() => {
      diff[0]!.before = "Bob"
    })
  })

  it("drops private fields planted by the input array", () => {
    class PlantedChanges extends Array {
      static get [Symbol.species]() {
        return PlantedChanges
      }

      map() {
        const planted = new PlantedChanges()
        planted.push({
          target,
          before: "Ada",
          after: "Grace",
          handle: "sentinel-handle",
          reversal: { marker: "reversal-sentinel" },
          packageBytes: "package-byte-sentinel",
        })
        planted.handle = "sentinel-handle"
        planted.reversal = { marker: "reversal-sentinel" }
        planted.packageBytes = "package-byte-sentinel"
        return planted
      }
    }

    const changes = new PlantedChanges()
    changes.push(
      change(target, "Ada", "Grace", {
        handle: "sentinel-handle",
        reversal: {
          marker: "reversal-sentinel",
          command: "private-undo-sentinel",
          nested: {
            handle: "sentinel-handle",
            packageBytes: "package-byte-sentinel",
            deeper: { reversal: { marker: "reversal-sentinel" } },
          },
        },
        packageBytes: "package-byte-sentinel",
      })
    )
    changes.handle = "sentinel-handle"
    changes.reversal = {
      marker: "reversal-sentinel",
      nested: { packageBytes: "package-byte-sentinel" },
    }
    changes.packageBytes = "package-byte-sentinel"
    const diff = paperReviewDiff(
      review(changes, {
        handle: "sentinel-handle",
        reversal: {
          marker: "reversal-sentinel",
          nested: { handle: "sentinel-handle" },
        },
        packageBytes: "package-byte-sentinel",
      })
    )
    assert.deepEqual(diff, [{ target, before: "Ada", after: "Grace" }])
    assertPublic(diff)

    const ownMap = [
      change(target, "Ada", "Grace", {
        handle: "sentinel-handle",
        reversal: { marker: "reversal-sentinel" },
        packageBytes: "package-byte-sentinel",
      }),
    ]
    Object.defineProperty(ownMap, "map", {
      value: () => [
        {
          target,
          before: "Ada",
          after: "Grace",
          handle: "sentinel-handle",
          reversal: { marker: "reversal-sentinel" },
          packageBytes: "package-byte-sentinel",
        },
      ],
    })
    assertPublic(paperReviewDiff(review(ownMap)))
  })

  it("keeps replacement order", () => {
    const diff = paperReviewDiff(
      review([change(target, "Ada", "Grace"), change(other, "Lin", "Mai")])
    )
    assert.deepEqual(
      diff.map((row) => row.target),
      [target, other]
    )
  })

  it("allows an empty after and an empty change list", () => {
    const empty = paperReviewDiff(review([]))
    assert.deepEqual(empty, [])
    assertPublic(empty)
    assert.deepEqual(paperReviewDiff(review([change(target, "Ada", "")])), [
      { target, before: "Ada", after: "" },
    ])
  })

  it("refuses a private payload, a duplicate, and a bad replacement", () => {
    assert.throws(
      () =>
        paperReviewDiff({
          handle: "sentinel-handle",
          reversal: { marker: "reversal-sentinel" },
          packageBytes: "package-byte-sentinel",
        }),
      /This Word review is unavailable/
    )
    assert.throws(
      () =>
        paperReviewDiff(
          review([change(target, "Ada", "Grace"), change(target, "Ada", "Ida")])
        ),
      /unavailable/
    )
    assert.throws(
      () => paperReviewDiff(review([change("target", "Ada", "Grace")])),
      /unavailable/
    )
    assert.throws(
      () => paperReviewDiff(review([change(target, "", "Grace")])),
      /unavailable/
    )
    assert.throws(
      () =>
        paperReviewDiff(
          review([change(target, "a".repeat(8 * 1024 + 1), "b")])
        ),
      /unavailable/
    )
    assert.throws(
      () => paperReviewDiff(review(Array.from({ length: 21 }, () => ({})))),
      /unavailable/
    )
    const hole = [change(target, "Ada", "Grace"), change(other, "Lin", "Mai")]
    delete hole[0]
    assert.throws(() => paperReviewDiff(review(hole)), /unavailable/)
  })
})
