import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  blankCv,
  blankLetter,
  legacyPaperDocumentSchema,
  nativePaperDocumentSchema,
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
    ...legacy(),
    version: 4,
    schemaRevision: 1,
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

  it("reads native provenance without publishing a document", () => {
    assert.equal(nativeProvenance(native()).schemaRevision, 1)
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
