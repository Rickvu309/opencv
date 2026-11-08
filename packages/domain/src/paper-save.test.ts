import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { it } from "node:test"

import {
  canShowSaved,
  create,
  grant,
  hash,
  save,
  type Fault,
} from "./paper-save.js"

it("hashes the stored bytes with sha256", () => {
  for (const bytes of ["", "old", "a".repeat(56), "a".repeat(57), "é"])
    assert.equal(hash(bytes), createHash("sha256").update(bytes).digest("hex"))
})

it("recognizes copied durable receipts and refuses missing or mismatched receipts", () => {
  const state = create("old")
  const lease = grant(state, "Tab A", 0)
  const parent = state.head
  const request = { id: "one", bytes: "new words", parent, lease, now: 1 }
  assert.equal(canShowSaved(state, parent, null), false)
  assert.equal(canShowSaved(state, hash(request.bytes), null), false)
  const receipt = save(state, request)
  const delivered = JSON.parse(JSON.stringify(receipt))
  assert.equal(canShowSaved(state, receipt.hash, delivered), true)
  assert.equal(canShowSaved(state, receipt.hash, null), false)
  assert.equal(
    canShowSaved(state, receipt.hash, { ...receipt, id: "unknown" }),
    false
  )
  assert.equal(
    canShowSaved(state, receipt.hash, { ...receipt, hash: parent }),
    false
  )
  save(state, {
    ...request,
    id: "two",
    bytes: "later words",
    parent: state.head,
    now: 2,
  })
  assert.equal(canShowSaved(state, receipt.hash, delivered), false)
})

it("refuses an expired lease before takeover without changing the stored head", () => {
  for (const now of [10, 11]) {
    const state = create("old")
    const lease = grant(state, "Tab A", 0)
    const head = state.head
    const packages = new Map(state.packages)
    assert.throws(
      () =>
        save(state, {
          id: "expired",
          bytes: "pending words",
          parent: head,
          lease,
          now,
        }),
      /stale lease/
    )
    assert.equal(state.head, head)
    assert.deepEqual(state.packages, packages)
    assert.equal(state.commits, 0)
    assert.equal(state.receipts.size, 0)
    assert.equal(state.retained.get("expired"), "pending words")
    assert.deepEqual(state.lease, lease)
  }
})

it("keeps one head when a lost reply is retried, and a crash leaves the old head", () => {
  const state = create("old")
  const lease = grant(state, "Tab A", 0)
  const request = {
    id: "one",
    bytes: "typed words",
    parent: state.head,
    lease,
    now: 1,
  }
  assert.throws(() => save(state, { ...request, crash: true }))
  assert.equal(state.head, hash("old"))
  assert.equal(state.receipts.size, 0)
  const first = save(state, request)
  const second = save(state, request)
  assert.deepEqual(first, second)
  assert.equal(state.receipts.size, 1)
  assert.equal(state.packages.get(first.hash), "typed words")
  assert.equal(state.commits, 1)
})

it("keeps one live lease, and a stale parent or a stale lease keeps the losing bytes", () => {
  const state = create("old")
  const tabA = grant(state, "Tab A", 0)
  const parent = state.head
  for (const writer of ["Tab B", "Coach"])
    assert.throws(() => grant(state, writer, 1), /held/)
  save(state, {
    id: "a",
    bytes: "new words",
    parent,
    lease: tabA,
    now: 1,
  })
  const newer = state.head
  assert.throws(
    () =>
      save(state, {
        id: "stale-parent",
        bytes: "older words",
        parent,
        lease: tabA,
        now: 2,
      }),
    /parent/
  )
  assert.equal(state.head, newer)
  assert.equal(state.retained.get("stale-parent"), "older words")
  const tabB = grant(state, "Tab B", 10)
  save(state, {
    id: "b",
    bytes: "newest words",
    parent: state.head,
    lease: tabB,
    now: 11,
  })
  const newest = state.head
  assert.throws(
    () =>
      save(state, {
        id: "stale-tab",
        bytes: "Tab A pending",
        parent: state.head,
        lease: tabA,
        now: 12,
      }),
    /lease/
  )
  assert.equal(state.head, newest)
  assert.equal(state.retained.get("stale-tab"), "Tab A pending")
  const coach = grant(state, "Coach", 20)
  assert.equal(coach.epoch, 3)
})

it("rejects each broken save rule", () => {
  const faults: Fault[] = [
    "receipt",
    "retry",
    "parent",
    "crash",
    "fence",
    "exclusive",
  ]
  for (const fault of faults) {
    const check = () => {
      const state = create("old", fault)
      const tabA = grant(state, "Tab A", 0)
      const parent = state.head
      const request = {
        id: "one",
        bytes: "new words",
        parent,
        lease: tabA,
        now: 1,
      }
      if (fault === "receipt") {
        assert.equal(canShowSaved(state, hash(request.bytes), null), false)
        return
      }
      if (fault === "exclusive") {
        grant(state, "Coach", 1)
        assert.ok(state.grants.filter((lease) => lease.until > 1).length <= 1)
        return
      }
      if (fault === "crash") {
        assert.throws(() => save(state, { ...request, crash: true }))
        assert.equal(state.head, parent)
        return
      }
      const receipt = save(state, request)
      assert.equal(canShowSaved(state, receipt.hash, receipt), true)
      if (fault === "retry") {
        save(state, request)
        assert.equal(state.commits, 1)
        return
      }
      if (fault === "parent") {
        assert.throws(
          () =>
            save(state, {
              ...request,
              id: "old",
              bytes: "older pending bytes",
            }),
          /parent/
        )
        return
      }
      grant(state, "Tab B", 10)
      assert.throws(
        () =>
          save(state, {
            ...request,
            id: "stale",
            bytes: "Stale writer overwrites newer words",
            parent: state.head,
            now: 11,
          }),
        /lease/
      )
    }
    assert.throws(check, undefined, `${fault} mutant must break the check`)
  }
})
