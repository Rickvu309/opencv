import { ERROR_CODES, personActor } from "@workspace/domain/kernel"
import {
  NATIVE_WRITER,
  RICH_NATIVE_WRITER,
  nativeProvenance,
  nativePaperDocumentSchema,
} from "@workspace/domain/paper-doc"
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
const outline = {
  name: "Letter",
  kind: "letter",
  status: "draft",
  truncated: false,
  revision: 8,
  nativeBasis: basis,
  outline: JSON.stringify([
    {
      id: "p1",
      type: "paragraph",
      selected: false,
      content: [{ text: "Việt 😀" }],
    },
  ]),
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
  const read = vi.fn<Registry["read"]>(async () => outline)
  const result = await resolve(read)
  expect(result.focusDoc).toMatchObject({
    revision: 8,
    nativeBasis: basis,
    outline: outline.outline,
  })
  expect(read.mock.calls).toEqual([
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
    writer: RICH_NATIVE_WRITER,
  })
})

it.each([undefined, { ...basis, digest: "bad" }, { ...basis, revision: 7 }])(
  "refuses malformed native outline authority %j",
  async (nativeBasis) => {
    await expect(
      resolve(async () => ({ ...outline, nativeBasis }))
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

it("keeps a missing or unowned document missing", async () => {
  await expect(
    resolve(async () => {
      throw new CommandError(ERROR_CODES.NOT_FOUND, "Missing")
    })
  ).rejects.toMatchObject({ code: ERROR_CODES.NOT_FOUND })
})

it("grounds selected attachments without taking authority from caller content", async () => {
  const read = vi.fn<Registry["read"]>(async () => outline)
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
  expect(read.mock.calls).toHaveLength(1)
  expect(read.mock.calls[0]?.[1]).toEqual({
    docId,
    blockIds: ["p1"],
    writer: NATIVE_WRITER,
  })
})
