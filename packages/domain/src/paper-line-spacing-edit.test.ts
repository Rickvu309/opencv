import assert from "node:assert/strict"
import { test } from "node:test"
import {
  paragraphSchema,
  paragraphEditSchema,
  lineSpacingWordUnits,
} from "./paper-doc/presentation-values.js"
import { formatChangeSchema } from "./paper-doc/native-formatting-patch.js"
import {
  checkSnapshot,
  validatePresentationPatch,
} from "./paper-doc/presentation-edit.js"

test("legacy line multiples remain readable while new formatting and presentation patches refuse them", () => {
  for (const value of [1.001, 1.01, 1.23]) {
    const paragraph = { lineSpacing: { kind: "multiple", value } }
    assert.equal(paragraphSchema.safeParse(paragraph).success, true)
    assert.equal(paragraphEditSchema.safeParse(paragraph).success, false)
    assert.deepEqual(lineSpacingWordUnits({ kind: "multiple", value }), {
      kind: "ok",
      value: Math.round(value * 240),
    })
    const checked = checkSnapshot({
      document: {
        codecVersion: 1,
        page: {
          width: 11906,
          height: 16838,
          orientation: "portrait",
          top: 1440,
          bottom: 1440,
          start: 1440,
          end: 1440,
        },
        inline: {},
        paragraph,
        styles: [
          { id: "legacy", parent: null, kind: "paragraph", values: paragraph },
        ],
      },
      blocks: [
        {
          ownerId: "body",
          paragraph,
          runs: [{ text: "Stored text", values: {} }],
        },
      ],
    })
    assert.equal(checked.kind, "ok")
    if (checked.kind !== "ok") throw new Error(checked.reason)
    const snapshot = checked.value
    const before = structuredClone(snapshot)
    for (const kind of ["document-paragraph", "body-paragraph"]) {
      const target = kind === "body-paragraph" ? { ownerId: "body" } : {}
      assert.equal(
        validatePresentationPatch(snapshot, {
          kind,
          ...target,
          values: paragraph,
        }).kind,
        "refused"
      )
    }
    assert.equal(
      validatePresentationPatch(snapshot, {
        kind: "named-style",
        id: "new-style",
        style: {
          id: "new-style",
          parent: null,
          kind: "paragraph",
          values: paragraph,
        },
      }).kind,
      "refused"
    )
    for (const change of [
      { kind: "document-paragraph", expected: paragraph, values: paragraph },
      {
        kind: "paragraph",
        target: { kind: "body", blockId: "body" },
        expected: paragraph,
        values: paragraph,
      },
      {
        kind: "named-style",
        id: "legacy",
        expected: snapshot.document.styles[0],
        values: snapshot.document.styles[0],
      },
    ])
      assert.equal(formatChangeSchema.safeParse(change).success, false)
    assert.equal(
      formatChangeSchema.safeParse({
        kind: "document-paragraph",
        expected: paragraph,
        values: { before: 123 },
      }).success,
      true
    )
    assert.equal(
      validatePresentationPatch(snapshot, {
        kind: "body-paragraph",
        ownerId: "body",
        values: { after: 123 },
      }).kind,
      "ok"
    )
    assert.deepEqual(snapshot, before)
  }
})
