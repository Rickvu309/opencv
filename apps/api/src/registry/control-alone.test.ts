import {
  ERROR_CODES,
  personActor,
  resourcesOverlap,
} from "@workspace/domain/kernel"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { z } from "zod"

import { withDatabase, type TestDatabase } from "../db/context.js"
import { user } from "../db/schema.js"
import { createMigratedTestDb } from "../test/harness.js"
import { bindOperation } from "./bind.js"
import { implementation as approve } from "./operations/actions/approve/server.js"
import { implementation as deny } from "./operations/actions/deny/server.js"
import { implementation as undo } from "./operations/activity/undo/server.js"
import { Registry } from "./registry.js"

const person = personActor("control-alone")
const jobId = "00000000-0000-4000-8000-000000000042"

let db: TestDatabase
let close: () => Promise<void>
let registry: Registry
let title = "Before"

beforeAll(async () => {
  const opened = await createMigratedTestDb()
  db = opened.db
  close = () => opened.client.close()
  await db.insert(user).values({
    id: person.userId,
    name: "Ada",
    email: "control-alone@example.com",
  })
  registry = new Registry()
  bindOperation(registry, approve)
  bindOperation(registry, deny)
  bindOperation(registry, undo)
})

afterAll(async () => {
  await close()
})

describe("Control with no context registered", () => {
  it("registers approve, deny and Undo, and nothing else", () => {
    const listed = registry.list()
    expect(
      [...listed.commands, ...listed.queries].map((entry) => entry.name).sort()
    ).toEqual(["actions.approve", "actions.deny", "activity.undo"])
  })

  it("an approval and an Undo touch every read, and a denial touches none", () => {
    const anyRead = { ownerId: person.userId, name: "any.read", entityId: "x" }
    const touchesOf = (operation: {
      writes: (input: never) => readonly { name: string }[]
    }) =>
      operation
        .writes(undefined as never)
        .map(({ name }) => ({ ownerId: person.userId, name }))
    for (const implementation of [approve, undo])
      expect(
        touchesOf(implementation.operation).some((touch) =>
          resourcesOverlap(touch, anyRead)
        )
      ).toBe(true)
    expect(touchesOf(deny.operation)).toEqual([])
  })

  it("undoes a command that any context could have registered", async () => {
    registry.addCommand(
      {
        name: "job.rename",
        description: "Rename fixture",
        input: z.object({ title: z.string() }).strict(),
        coach: "auto",
        destructive: false,
        step: () => "Rename fixture",
        reversal: (input, output: { previous: string }) => ({
          command: "job.rename",
          input: { title: output.previous },
          expect: {
            query: "job.title",
            input: {},
            matches: { title: input.title },
            skipped: "The title changed again, so Undo was skipped",
          },
        }),
        activity: (input) => ({
          subjectKind: "job",
          subjectId: jobId,
          summary: `You renamed it to ${input.title}`,
        }),
      },
      async (input) => {
        const previous = title
        title = input.title
        return { previous }
      }
    )
    registry.addQuery({
      name: "job.title",
      description: "Title fixture",
      input: z.object({}).strict(),
      coach: false,
      step: () => "Title fixture",
      read: async () => ({ title }),
    })
    await withDatabase(db, async () => {
      const renamed = await registry.execute({
        name: "job.rename",
        input: { title: "After" },
        actor: person,
      })
      expect(title).toBe("After")
      expect(renamed.activityId).toEqual(expect.any(String))
      const undone = await registry.execute({
        name: "activity.undo",
        input: { activityId: renamed.activityId },
        actor: person,
      })
      expect(title).toBe("Before")
      expect(undone.output).toMatchObject({ command: "job.rename" })
    })
  })

  it("refuses to approve or deny a proposal that does not exist", async () => {
    await withDatabase(db, async () => {
      for (const name of ["actions.approve", "actions.deny"])
        await expect(
          registry.execute({
            name,
            input: { pendingActionId: "00000000-0000-4000-8000-000000000043" },
            actor: person,
          })
        ).rejects.toMatchObject({ code: ERROR_CODES.NOT_FOUND })
    })
  })
})
