import { afterEach, describe, expect, it } from "vitest"
import * as Y from "yjs"
import {
  canonical,
  type Result,
} from "@workspace/domain/internal/paper-presentation"
import {
  createPrivateLayout,
  readLayout,
  openLayoutBinary,
  commitLayoutPhotoEdit,
  undoLayoutPhotoEdit,
  readLayoutPhotoReceipt,
  type LayoutBinding,
} from "../native-layout.js"
import { toLayoutBlocks, fromLayoutBlocks } from "../native-layout-codec.js"
import { photoFixture, photoLayoutFixture } from "./photo-fixture.js"

const bindings = new Set<LayoutBinding>()
afterEach(() => {
  for (const binding of bindings) {
    binding.engine._tiptapEditor.destroy()
    binding.doc.destroy()
  }
  bindings.clear()
})
function value<T>(result: Result<T>): T {
  if (result.kind === "refused") throw new Error(result.reason)
  return result.value
}
function source() {
  const binding = value(createPrivateLayout(photoLayoutFixture()))
  bindings.add(binding)
  return binding
}
function reopen(binding: LayoutBinding) {
  const next = openLayoutBinary(
    Y.encodeStateAsUpdate(binding.doc),
    binding.kind
  )
  bindings.add(next)
  return next
}
function edit(binding: LayoutBinding, id: string, change: unknown) {
  return value(
    commitLayoutPhotoEdit(binding, id, change, canonical(readLayout(binding)))
  )
}
function findPhoto(parent: Y.XmlFragment): Y.XmlElement | undefined {
  for (const child of parent.toArray()) {
    if (!(child instanceof Y.XmlElement)) continue
    if (child.nodeName === "paperPhoto") return child
    const nested = findPhoto(child)
    if (nested) return nested
  }
  return undefined
}
describe("owned layout photo binary and receipt recovery", () => {
  it("roundtrips geometry, source, wrapping, spacing, alt and formatted tables", () => {
    const binding = source()
    expect(readLayout(reopen(binding))).toEqual(photoLayoutFixture())
    const doc = readLayout(binding)
    expect(
      fromLayoutBlocks(
        toLayoutBlocks(doc),
        doc.kind,
        doc.presentation,
        doc.profile
      )
    ).toEqual(doc)
  })
  it("refuses v2 bytes relabelled as v1 without rewriting the fragment", () => {
    const binding = source()
    binding.doc.getMap("paper").set("formattingProfile", "private-layout-1")
    const bytes = Y.encodeStateAsUpdate(binding.doc)
    expect(() => readLayout(binding)).toThrow()
    expect(Y.encodeStateAsUpdate(binding.doc)).toEqual(bytes)
  })
  it("refuses malformed or extra photo wire attributes", () => {
    const binding = source(),
      photo = findPhoto(binding.fragment)
    if (!photo) throw new Error("Missing photo wire")
    photo.setAttribute("surprise", "value")
    expect(() => readLayout(binding)).toThrow()
  })
  it("keeps insert operation retry idempotent after reopening and rejects reuse", () => {
    const binding = source(),
      basis = canonical(readLayout(binding)),
      change = {
        kind: "insert-photo",
        photo: { ...photoFixture(), id: "second" },
        destination: { parentId: "flow", afterId: "portrait" },
      }
    const receipt = value(
      commitLayoutPhotoEdit(binding, "insert", change, basis)
    )
    const fresh = reopen(binding),
      bytes = Y.encodeStateAsUpdate(fresh.doc)
    expect(
      value(commitLayoutPhotoEdit(fresh, "insert", change, basis))
    ).toEqual(receipt)
    expect(Y.encodeStateAsUpdate(fresh.doc)).toEqual(bytes)
    expect(
      commitLayoutPhotoEdit(
        fresh,
        "insert",
        { ...change, destination: { parentId: "flow", afterId: null } },
        basis
      ).kind
    ).toBe("refused")
    expect(readLayoutPhotoReceipt(fresh, "insert")).toEqual(receipt)
  })
  it("recovers selective Undo while preserving a later alt edit", () => {
    const binding = source()
    edit(binding, "rotate", {
      kind: "update-photo",
      photo: { ...photoFixture(), rotation: 90 },
    })
    edit(binding, "alt", {
      kind: "update-photo",
      photo: { ...photoFixture(), rotation: 90, alt: "Later description" },
    })
    const fresh = reopen(binding)
    value(undoLayoutPhotoEdit(fresh, "rotate", canonical(readLayout(fresh))))
    expect(
      readLayout(fresh).flow.children.find((node) => node.type === "photo")
    ).toEqual({ ...photoFixture(), alt: "Later description" })
    const bytes = Y.encodeStateAsUpdate(fresh.doc)
    value(undoLayoutPhotoEdit(fresh, "rotate", canonical(readLayout(fresh))))
    expect(Y.encodeStateAsUpdate(fresh.doc)).toEqual(bytes)
  })
  it("preserves the binary on stale basis and same-property stale Undo", () => {
    const binding = source(),
      basis = canonical(readLayout(binding))
    edit(binding, "rotate", {
      kind: "update-photo",
      photo: { ...photoFixture(), rotation: 90 },
    })
    edit(binding, "later", {
      kind: "update-photo",
      photo: { ...photoFixture(), rotation: 180 },
    })
    const bytes = Y.encodeStateAsUpdate(binding.doc)
    expect(
      commitLayoutPhotoEdit(
        binding,
        "stale",
        { kind: "remove-photo", photoId: "portrait" },
        basis
      ).kind
    ).toBe("refused")
    expect(
      undoLayoutPhotoEdit(binding, "rotate", canonical(readLayout(binding)))
        .kind
    ).toBe("refused")
    expect(Y.encodeStateAsUpdate(binding.doc)).toEqual(bytes)
  })
  it("moves to a table cell, replaces, removes and reverses across binary recovery", () => {
    const binding = source(),
      original = readLayout(binding)
    edit(binding, "move", {
      kind: "move-photo",
      photoId: "portrait",
      destination: { parentId: "r1-a", afterId: "r1-a-p" },
    })
    edit(binding, "replace", {
      kind: "replace-photo",
      photoId: "portrait",
      source: "file:00000000-0000-4000-8000-000000000002",
    })
    edit(binding, "remove", { kind: "remove-photo", photoId: "portrait" })
    const fresh = reopen(binding)
    for (const id of ["remove", "replace", "move"])
      value(undoLayoutPhotoEdit(fresh, id, canonical(readLayout(fresh))))
    expect(readLayout(fresh)).toEqual(original)
  })
})
