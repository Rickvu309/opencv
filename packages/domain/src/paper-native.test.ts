import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  NATIVE_WRITER,
  applyPaperEdits,
  blankLetter,
  canonicalPaper,
  legacyPaperDocumentSchema,
  nativeAdmission,
  nativePaperDocumentSchema,
  nativePaperFromLegacy,
  nativeProvenance,
  nativeProvenanceSchema,
  normalizeRuns,
  rebasePending,
  sameNativeProvenance,
} from "./paper-doc/index.ts"
import { rebaseRuns } from "./paper-doc/merge-text.ts"

const legacy = () =>
  legacyPaperDocumentSchema.parse({
    ...blankLetter(),
    blocks: [{ id: "p1", type: "paragraph", content: [{ text: "Dear team" }] }],
  })

const native = () =>
  nativePaperDocumentSchema.parse({
    ...nativePaperFromLegacy(legacy()),
    blocks: [
      {
        id: "p1",
        type: "paragraph",
        content: [
          { text: "Dear ", bold: true, underline: true },
          {
            text: "team",
            italic: true,
            underline: true,
            href: "https://example.com",
          },
        ],
      },
    ],
  })

describe("versioned native prose", () => {
  it("converts legacy documents without changing their IDs, words or source", () => {
    const source = legacy()
    const before = canonicalPaper(source)
    const target = nativePaperFromLegacy(source)
    assert.equal(target.version, 4)
    assert.equal(target.schemaRevision, 1)
    assert.deepEqual(target.blocks, source.blocks)
    assert.deepEqual(target.clashes, source.clashes)
    assert.equal(canonicalPaper(source), before)
    assert.equal(legacyPaperDocumentSchema.safeParse(target).success, false)
  })

  it("refuses underline in v3 and preserves all native marks during normalization", () => {
    const target = native()
    assert.equal(
      legacyPaperDocumentSchema.safeParse({
        version: 3,
        kind: target.kind,
        blocks: target.blocks,
        clashes: target.clashes,
      }).success,
      false
    )
    const runs = normalizeRuns([
      { text: "Việt ", underline: true },
      { text: "Nam", underline: true },
      { text: " plain" },
    ])
    assert.deepEqual(runs, [
      { text: "Việt Nam", underline: true },
      { text: " plain" },
    ])
    assert.equal(
      nativePaperDocumentSchema.safeParse({ ...target, schemaRevision: 2 })
        .success,
      false
    )
  })

  it("requires a compatible writer before exposing native content", () => {
    const target = native()
    assert.equal(nativeAdmission(target, NATIVE_WRITER), null)
    assert.ok(nativeAdmission(target, undefined))
    assert.ok(
      nativeAdmission(target, {
        ...NATIVE_WRITER,
        capabilities: ["structured-prose"],
      })
    )
    assert.ok(
      nativeAdmission(target, {
        ...NATIVE_WRITER,
        supportedSchemaRevisions: [2],
      })
    )
    assert.equal(nativeProvenance(target).schemaRevision, 1)
  })

  it("refuses omitted, repeated and unknown required capabilities", () => {
    const provenance = nativeProvenance(native())
    for (const requiredCapabilities of [
      ["structured-prose"],
      ["structured-prose", "structured-prose"],
      ["structured-prose", "future-grid"],
    ])
      assert.equal(
        nativeProvenanceSchema.safeParse({
          ...provenance,
          requiredCapabilities,
        }).success,
        false
      )
    assert.equal(
      sameNativeProvenance(provenance, {
        ...provenance,
        requiredCapabilities: ["structured-prose", "structured-prose"],
      }),
      false
    )
    assert.equal(
      sameNativeProvenance(
        {
          ...provenance,
          requiredCapabilities: ["structured-prose", "structured-prose"],
        },
        provenance
      ),
      false
    )
    assert.equal(
      sameNativeProvenance(provenance, {
        ...provenance,
        requiredCapabilities: [...provenance.requiredCapabilities].reverse(),
      }),
      true
    )
  })

  it("keeps underline around changed words and concurrent recovery", () => {
    const target = native()
    const p = target.blocks[0]!
    assert.ok("content" in p)
    assert.deepEqual(rebaseRuns(p.content, "Dear hiring team"), [
      { text: "Dear hiring ", bold: true, underline: true },
      {
        text: "team",
        italic: true,
        underline: true,
        href: "https://example.com",
      },
    ])
    const ours = nativePaperDocumentSchema.parse({
      ...target,
      blocks: [
        { ...p, content: [...p.content, { text: " ours", underline: true }] },
      ],
    })
    const theirs = nativePaperDocumentSchema.parse({
      ...target,
      blocks: [
        {
          ...p,
          content: [
            { text: "Dear ", bold: true, underline: true },
            {
              text: "colleagues",
              italic: true,
              underline: true,
              href: "https://example.com",
            },
          ],
        },
      ],
    })
    const merged = rebasePending({ base: target, ours, theirs }).document
    assert.equal(merged.version, 4)
    assert.ok(
      merged.blocks.some(
        (block) =>
          "content" in block && block.content.some((run) => run.underline)
      )
    )
    assert.throws(
      () => rebasePending({ base: legacy(), ours: target, theirs: target }),
      /explicit migration/
    )
  })
})

it("keeps native underline when Coach changes that block's words", () => {
  const source = nativePaperDocumentSchema.parse({
    version: 4,
    schemaRevision: 1,
    kind: "letter",
    blocks: [
      {
        id: "p1",
        type: "paragraph",
        content: [{ text: "Việt 😀 dear team", underline: true }],
      },
    ],
    clashes: [],
  })
  const result = applyPaperEdits(
    source,
    source,
    [{ op: "setText", blockId: "p1", text: "Việt 😀 dear **colleagues**" }],
    () => "unused"
  )
  assert.equal(result.applied, 1)
  const paragraph = result.target.blocks[0]!
  assert.ok("content" in paragraph)
  assert.deepEqual(paragraph.content, [
    { text: "Việt 😀 dear ", underline: true },
    { text: "colleagues", underline: true, bold: true },
  ])
})
