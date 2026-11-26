import { eq } from "drizzle-orm"

import { jobChecklist } from "../db/schema.js"
import { flag, idOf, text } from "../registry/coverage-helpers.test-support.js"
import type { ExecuteResult } from "../registry/registry.js"
import {
  outputOf,
  reversalInputOf,
  type LaterCases,
  type LaterWorld,
} from "../registry/undo-later.test-support.js"

export async function jobField(
  world: LaterWorld,
  a: ExecuteResult,
  field: string
) {
  return text(await world.read("job.get", { jobId: idOf(a.output) }), field)
}

function reversalJob(world: LaterWorld, a: ExecuteResult) {
  return world.read("job.get", {
    jobId: String(reversalInputOf(a).jobId ?? idOf(a.output)),
  })
}

async function checklistDone(world: LaterWorld, itemId: string) {
  const [row] = await world.db
    .select({ done: jobChecklist.done })
    .from(jobChecklist)
    .where(eq(jobChecklist.id, itemId))
  return row?.done
}

const linked: { docId?: string } = {}

export const jobUndoLater: LaterCases = {
  "job.create": {
    act: async (a, { run }) => {
      await run("job.update", {
        jobId: idOf(a.output),
        patch: { location: "Osaka" },
      })
    },
    survives: async (a, world) =>
      (await jobField(world, a, "location").catch(() => "gone")) === "Osaka",
  },
  "job.update": {
    act: async (a, { run }) => {
      await run("job.update", {
        jobId: idOf(a.output),
        patch: { location: "Osaka" },
      })
    },
    survives: async (a, world) =>
      (await jobField(world, a, "location")) === "Osaka",
  },
  "job.setPriority": {
    act: async (a, { run }) => {
      await run("job.update", {
        jobId: idOf(a.output),
        patch: { priority: "low" },
      })
    },
    survives: async (a, world) =>
      (await jobField(world, a, "priority")) === "low",
  },
  "job.move": {
    act: async (a, { run }) => {
      await run("job.move", { jobId: idOf(a.output), stage: "interview" })
    },
    survives: async (a, world) =>
      (await jobField(world, a, "stage")) === "interview",
  },
  "job.star": {
    act: async (a, { run }) => {
      await run("job.star", { jobId: idOf(a.output), starred: false })
    },
    survives: async (a, world) => !flag(await reversalJob(world, a), "starred"),
  },
  "job.addChecklistItem": {
    act: async (a, { run }) => {
      await run("job.setChecklistItem", {
        jobId: outputOf(a).jobId,
        itemId: outputOf(a).id,
        done: true,
      })
    },
    survives: async (a, world) =>
      (await checklistDone(world, String(outputOf(a).id))) === true,
  },
  "job.setChecklistItem": {
    act: async (a, { run }) => {
      await run("job.setChecklistItem", {
        jobId: outputOf(a).jobId,
        itemId: outputOf(a).id,
        done: false,
      })
    },
    survives: async (a, world) =>
      (await checklistDone(world, String(outputOf(a).id))) === false,
  },
  "job.linkPaper": {
    act: async (a, { run }) => {
      const docId = idOf(
        (await run("paper.create", { kind: "cv", name: "Later CV" })).output
      )
      await run("job.linkPaper", { jobId: idOf(a.output), docId, kind: "cv" })
      linked.docId = docId
    },
    survives: async (a, world) =>
      text(await reversalJob(world, a), "cvDocId") === linked.docId,
  },
}
