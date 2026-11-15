import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  NATIVE_WRITER,
  applyPaperEdits,
  rebasePending,
  blankCv,
  blankLetter,
  canonicalPaper,
  legacyPaperDocumentSchema,
  nativeAdmission,
  nativePaperDocumentSchema,
  nativePaperFromLegacy,
  nativeProvenance,
  nativeProvenanceSchema,
  normalizeRuns,
  paperDocumentSchema,
  sameNativeProvenance,
  type CvPaper,
  type LetterPaper,
  type PaperDocument,
} from "./paper-doc/index.ts"

const legacyVersion = (
  document: PaperDocument | CvPaper | LetterPaper
): 3 | 4 => document.version

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

describe("isolated native prose model", () => {
  it("keeps blank documents at version 3 while public aliases accept native documents", () => {
    assert.equal(legacyVersion(blankCv()), 3)
    assert.equal(legacyVersion(blankLetter()), 3)
  })

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
    assert.deepEqual(paperDocumentSchema.parse(target), target)
    const unsupported = { ...target, schemaRevision: 2 }
    assert.equal(paperDocumentSchema.safeParse(unsupported).success, false)
    assert.deepEqual(paperDocumentSchema.parse(source), source)
  })

  it("refuses underline in v3 and preserves all native marks during normalization", () => {
    const target = native()
    assert.equal(
      paperDocumentSchema.safeParse({
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

  it("computes native writer compatibility without publishing a document", () => {
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
})

it("refuses native fields and unsupported marks at the legacy public parser", () => {
  const source = legacy()
  assert.equal(
    paperDocumentSchema.safeParse({ ...source, schemaRevision: 1 }).success,
    false
  )
  assert.equal(
    nativePaperDocumentSchema.safeParse({ ...native(), version: 5 }).success,
    false
  )
  const [paragraph] = source.blocks
  assert.ok(paragraph)
  for (const content of [
    [{ text: "Dear team", underline: true }],
    [{ text: "Dear team", futureMark: true }],
  ])
    assert.equal(
      paperDocumentSchema.safeParse({
        ...source,
        blocks: [{ ...paragraph, content }],
      }).success,
      false
    )
})

it("applies native structural invariants to nested blocks", () => {
  const source = native()
  const [paragraph] = source.blocks
  assert.ok(paragraph)
  assert.equal(
    nativePaperDocumentSchema.safeParse({
      ...source,
      blocks: [
        paragraph,
        {
          id: "list",
          type: "bullet",
          content: [{ text: "list" }],
          children: [{ ...paragraph, type: "bullet", children: [] }],
        },
      ],
    }).success,
    false
  )
})

it("edits native Unicode text without losing underline or changing the source", () => {
  const source = nativePaperDocumentSchema.parse({
    ...native(),
    blocks: [
      {
        id: "p1",
        type: "paragraph",
        content: [{ text: "Việt 😀 team", underline: true }],
      },
    ],
  })
  const before = canonicalPaper(source)
  const result = applyPaperEdits(
    source,
    source,
    [{ op: "setText", blockId: "p1", text: "Việt 😃 **colleagues**" }],
    () => "fresh"
  )
  assert.equal(result.target.version, 4)
  assert.deepEqual(result.target.blocks[0], {
    id: "p1",
    type: "paragraph",
    content: [
      { text: "Việt 😃 ", underline: true },
      { text: "colleagues", bold: true, underline: true },
    ],
  })
  assert.equal(canonicalPaper(source), before)
})

it("refuses mixed schema edits and recovery before fallback", () => {
  const v3 = legacy()
  const v4 = native()
  assert.throws(() => applyPaperEdits(v3, v4, [], () => "fresh"), /schema/)
  assert.throws(
    () => rebasePending({ base: v3, ours: v4, theirs: v3 }),
    /schema/
  )
  assert.throws(
    () => rebasePending({ base: blankCv(), ours: v3, theirs: v3 }),
    /schema/
  )
})
