import {
  NATIVE_WRITER,
  ERROR_CODES,
  personActor,
  nativeProvenance,
  nativePaperDocumentSchema,
} from "@workspace/domain"
import { expect, it, vi } from "vitest"
import { CommandError } from "../platform/errors.js"
import { Registry } from "../registry/registry.js"
import { resolveTurnGrounding } from "./context.js"
import { coachTurnContext } from "./instructions.js"
import { fakePaperEdit } from "./fake.js"

const paper = nativePaperDocumentSchema.parse({
  version: 4,
  schemaRevision: 1,
  kind: "letter",
  clashes: [],
  blocks: [
    {
      id: "p1",
      type: "paragraph",
      content: [{ text: "Việt 😀", underline: true }],
    },
  ],
})
const basis = {
  provenance: nativeProvenance(paper),
  epoch: 1,
  revision: 8,
  digest: "a".repeat(64),
}
const docId = "01990b00-0000-7000-8000-000000000001"
const actor = personActor("native-context")
const metadata = {
  id: docId,
  name: "Letter",
  kind: "letter",
  status: "draft",
  paper,
  nativeBasis: { ...basis, revision: 7 },
}
const outline = {
  revision: 8,
  nativeBasis: basis,
  outline: "Letter\n[p1] Việt 😀",
}
function resolve(read: Registry["read"]) {
  return resolveTurnGrounding({
    registry: Object.assign(new Registry(), { read }),
    actor,
    requestFocusDocId: docId,
    storedKind: null,
    storedId: null,
    memoryEnabled: false,
  })
}

it("takes revision and basis from the same outline despite older metadata", async () => {
  const read = vi.fn<Registry["read"]>(async (name) =>
    name === "paper.list" ? [metadata] : outline
  )
  const result = await resolve(read)
  expect(result.focusDoc).toMatchObject({
    revision: 8,
    nativeBasis: basis,
    outline: outline.outline,
  })
  expect(read.mock.calls).toEqual([
    ["paper.list", { writer: NATIVE_WRITER }, actor],
    [
      "paper.outline",
      { docId, blockIds: undefined, writer: NATIVE_WRITER },
      actor,
    ],
  ])
  expect(JSON.parse(coachTurnContext(result)).document.nativeBasis).toEqual(
    basis
  )
  expect(fakePaperEdit(result.focusDoc!)).toMatchObject({
    basedOn: 8,
    nativeBasis: basis,
    writer: NATIVE_WRITER,
  })
})

it.each([undefined, { ...basis, digest: "bad" }, { ...basis, revision: 7 }])(
  "refuses malformed native outline authority %j",
  async (nativeBasis) => {
    await expect(
      resolve(async (name) =>
        name === "paper.list" ? [metadata] : { ...outline, nativeBasis }
      )
    ).rejects.toThrow()
  }
)

it.each([
  ERROR_CODES.CONFLICT,
  ERROR_CODES.UNAUTHORIZED,
  ERROR_CODES.VALIDATION_ERROR,
])("does not downgrade %s to Word", async (code) => {
  const read = vi.fn<Registry["read"]>(async () => {
    throw new CommandError(code, "Refused")
  })
  await expect(resolve(read)).rejects.toMatchObject({ code })
  expect(read).toHaveBeenCalledTimes(1)
})

it("permits only missing block storage to fall back to Word and keeps its UUID revision", async () => {
  const revision = "01990b00-0000-7000-8000-000000000002"
  const read = vi.fn<Registry["read"]>(async (name) => {
    if (name === "paper.list") return []
    if (name === "paper.read")
      return {
        generation: "package",
        docId,
        name: "Word Letter",
        kind: "letter",
      }
    return {
      revision,
      outline: `Letter
[line ${revision}] Words`,
    }
  })
  const result = await resolve(read)
  expect(result.focusDoc).toMatchObject({ revision })
  expect(result.focusDoc?.nativeBasis).toBeUndefined()
  expect(fakePaperEdit(result.focusDoc!)).not.toHaveProperty("writer")
})

it("keeps a missing or unowned document missing", async () => {
  await expect(
    resolve(async (name) => {
      if (name === "paper.list") return []
      throw new CommandError(ERROR_CODES.NOT_FOUND, "Missing")
    })
  ).rejects.toMatchObject({ code: ERROR_CODES.NOT_FOUND })
})

it("grounds selected attachments without taking authority from caller content", async () => {
  const read = vi.fn<Registry["read"]>(async (name) =>
    name === "paper.list" ? [metadata] : outline
  )
  const result = await resolveTurnGrounding({
    registry: Object.assign(new Registry(), { read }),
    actor,
    requestFocusDocId: null,
    storedKind: null,
    storedId: null,
    memoryEnabled: false,
    context: [{ kind: "paper", id: docId, blockIds: ["p1"] }],
  })
  expect(result.focusDoc).toBeUndefined()
  expect(result.note).toContain(JSON.stringify(basis))
  expect(read.mock.calls[1]?.[1]).toEqual({
    docId,
    blockIds: ["p1"],
    writer: NATIVE_WRITER,
  })
})

it("leaves legacy numeric proposals unqualified", async () => {
  const result = await resolve(async (name) =>
    name === "paper.list"
      ? [{ ...metadata, paper: { version: 3 }, nativeBasis: undefined }]
      : { outline: "Letter\n[p1] Legacy", revision: 4 }
  )
  const input = fakePaperEdit(result.focusDoc!)
  expect(input.basedOn).toBe(4)
  expect(input).not.toHaveProperty("nativeBasis")
  expect(input).not.toHaveProperty("writer")
})
