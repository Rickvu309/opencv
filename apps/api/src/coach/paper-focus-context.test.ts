import { ERROR_CODES, personActor } from "@workspace/domain/kernel"
import { expect, it, vi } from "vitest"
import { CommandError } from "../platform/errors.js"
import { Registry } from "../registry/registry.js"
import { resolveTurnGrounding } from "./context.js"
import { coachTurnContext } from "./instructions.js"
import { fakePaperEdit } from "./fake.js"

const docId = "01990b00-0000-7000-8000-000000000001"
const actor = personActor("paper-focus-context")
const outline = {
  name: "Letter",
  kind: "letter",
  status: "draft",
  truncated: false,
  revision: 8,
  engine: 2,
  outline: JSON.stringify([
    {
      id: "p1",
      kind: "body",
      text: "Việt 😀",
      marks: [{ type: "underline", from: 0, to: 4 }],
      selected: false,
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

it("takes the revision from one outline and proposes engine commands against it", async () => {
  const read = vi.fn<Registry["read"]>(async () => outline)
  const result = await resolve(read)
  expect(result.focusDoc).toMatchObject({
    revision: 8,
    engine: 2,
    outline: outline.outline,
  })
  expect(read.mock.calls).toEqual([
    ["paper.outline", { docId, blockIds: undefined }, actor],
  ])
  expect(JSON.parse(coachTurnContext(result)).document.revision).toBe(8)
  const edit = fakePaperEdit(result.focusDoc!)
  expect(edit).toEqual({
    docId,
    basedOn: 8,
    commands: [
      {
        op: "replaceText",
        range: {
          from: { block: "p1", offset: 0 },
          to: { block: "p1", offset: 0 },
        },
        expect: "",
        text: "Reviewed by the Coach. ",
      },
    ],
  })
})

it.each([
  { ...outline, revision: undefined },
  { ...outline, outline: 5 },
  { ...outline, engine: 1 },
])("refuses a malformed outline %j", async (bad) => {
  await expect(resolve(async () => bad)).rejects.toThrow()
})

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
  expect(result.note).toContain(JSON.stringify(outline.outline))
  expect(read.mock.calls).toHaveLength(1)
  expect(read.mock.calls[0]?.[1]).toEqual({
    docId,
    blockIds: ["p1"],
  })
})
