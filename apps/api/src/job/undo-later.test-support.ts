import { catalog } from "@workspace/domain/kernel"
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
  [catalog["job.create"].name]: {
    act: async (a, { run }) => {
      await run("job.update", {
        jobId: idOf(a.output),
        patch: { location: "Osaka" },
      })
    },
    survives: async (a, world) =>
      (await jobField(world, a, "location").catch(() => "gone")) === "Osaka",
  },
  [catalog["job.update"].name]: {
    act: async (a, { run }) => {
      await run("job.update", {
        jobId: idOf(a.output),
        patch: { location: "Osaka" },
      })
    },
    survives: async (a, world) =>
      (await jobField(world, a, "location")) === "Osaka",
  },
  [catalog["job.setPriority"].name]: {
    act: async (a, { run }) => {
      await run("job.update", {
        jobId: idOf(a.output),
        patch: { priority: "low" },
      })
    },
    survives: async (a, world) =>
      (await jobField(world, a, "priority")) === "low",
  },
  [catalog["job.move"].name]: {
    act: async (a, { run }) => {
      await run("job.move", { jobId: idOf(a.output), stage: "interview" })
    },
    survives: async (a, world) =>
      (await jobField(world, a, "stage")) === "interview",
  },
  [catalog["job.star"].name]: {
    act: async (a, { run }) => {
      await run("job.star", { jobId: idOf(a.output), starred: false })
    },
    survives: async (a, world) => !flag(await reversalJob(world, a), "starred"),
  },
  [catalog["job.addChecklistItem"].name]: {
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
  [catalog["job.setChecklistItem"].name]: {
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
  [catalog["job.linkPaper"].name]: {
    act: async (a, { run, newCv }) => {
      const docId = await newCv("Later CV")
      await run("job.linkPaper", { jobId: idOf(a.output), docId, kind: "cv" })
      linked.docId = docId
    },
    survives: async (a, world) =>
      text(await reversalJob(world, a), "cvDocId") === linked.docId,
  },
}
