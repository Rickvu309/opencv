import { afterAll, beforeAll, describe, expect, it } from "vitest"

import {
  jobOf,
  paper,
  saved,
  type Item,
  type Job,
} from "./apply.test-support.js"
import {
  dataOf,
  failureOf,
  openWorld,
  type Person,
  type World,
} from "./person.test-support.js"

type Receipt = {
  id: string
  command: string
  summary: string
  undoneAt: string | null
  reversible: boolean
}

let world: World

beforeAll(async () => {
  world = await openWorld()
})

afterAll(async () => {
  await world.close()
})

async function receipts(person: Person, jobId: string) {
  return dataOf<Receipt[]>(
    await person.read("activity.list", { subjectKind: "job", subjectId: jobId })
  )
}

describe("the receipts a person reads for a Job", () => {
  it("say what the person did, in their words", async () => {
    const ada = await world.person("Ada")
    const typed = await saved(ada)
    const linked = await saved(ada, {
      title: "Linked",
      jobUrl: "https://jobs.example.org/roles/7",
    })
    await ada.run("job.star", { jobId: typed.id, starred: true })
    await ada.run("job.star", { jobId: typed.id, starred: false })
    await ada.run("job.move", { jobId: typed.id, stage: "applied" })
    await ada.run("job.setPriority", { jobId: typed.id, priority: "high" })
    await ada.run("job.addChecklistItem", { jobId: typed.id, label: "Call" })
    await ada.run("job.update", {
      jobId: typed.id,
      patch: { location: "Hanoi" },
    })
    const cv = await paper(ada, "cv", "Marketing CV")
    await ada.run("job.linkPaper", {
      jobId: typed.id,
      docId: cv.id,
      kind: "cv",
    })
    expect(
      (await receipts(ada, typed.id)).map((receipt) => receipt.summary).sort()
    ).toEqual(
      [
        "You added this job from the board",
        "You starred it",
        "You unstarred it",
        "You moved it to applied",
        "You set priority to high",
        'You added "Call" to the checklist',
        "Updated the job",
        "You linked Marketing CV",
      ].sort()
    )
    expect(
      (await receipts(ada, linked.id)).map((receipt) => receipt.summary)
    ).toEqual(["You added this job from jobs.example.org"])
  })

  it("keep a note as its own receipt, which Undo cannot take back", async () => {
    const ada = await world.person("Ada")
    const job = await saved(ada)
    const noted = dataOf<{ activityId?: string | null }>(
      await ada.run("job.addNote", { jobId: job.id, body: "Lan replied" })
    )
    const note = (await receipts(ada, job.id)).find(
      (receipt) => receipt.command === "job.addNote"
    )
    expect(note).toMatchObject({ summary: "Lan replied", reversible: false })
    expect(noted.activityId).toBe(note?.id)
  })

  it("are not kept for removing a checklist item or unlinking a Paper", async () => {
    const ada = await world.person("Ada")
    const job = await saved(ada)
    const item = dataOf<Item>(
      await ada.run("job.addChecklistItem", { jobId: job.id, label: "Call" })
    )
    const removed = dataOf<{ activityId?: string | null }>(
      await ada.run("job.removeChecklistItem", {
        jobId: job.id,
        itemId: item.id,
      })
    )
    expect(removed.activityId ?? null).toBeNull()
    const cv = await paper(ada, "cv", "Marketing CV")
    await ada.run("job.linkPaper", { jobId: job.id, docId: cv.id, kind: "cv" })
    const unlinked = dataOf<Job>(
      await ada.run("job.unlinkPaper", { jobId: job.id, kind: "cv" })
    )
    expect(unlinked.activityId ?? null).toBeNull()
    expect(
      (await receipts(ada, job.id)).map((receipt) => receipt.command).sort()
    ).toEqual(["job.addChecklistItem", "job.create", "job.linkPaper"])
  })
})

describe("refusals name what the person needs", () => {
  it("names the saved Job when a link is saved twice", async () => {
    const ada = await world.person("Ada")
    const first = await saved(ada, {
      jobUrl: "https://careers.example.com/named",
    })
    const refused = failureOf(
      await ada.run("job.create", {
        title: "Again",
        company: "Northwind",
        jobUrl: "https://careers.example.com/named",
      })
    )
    expect(refused).toMatchObject({
      code: "DUPLICATE_JOB",
      jobId: first.id,
    })
  })

  it("says why Undo of a move was skipped after a later move", async () => {
    const ada = await world.person("Ada")
    const job = await saved(ada)
    const first = dataOf<Job>(
      await ada.run("job.move", { jobId: job.id, stage: "applied" })
    )
    await ada.run("job.move", { jobId: job.id, stage: "interview" })
    const undone = await ada.undo(String(first.activityId))
    expect(failureOf(undone)).toMatchObject({
      code: "CONFLICT",
      message: "This card moved again, so Undo was skipped",
    })
  })
})

describe("Undo of a priority change never erases a later change", () => {
  it("says why Undo was skipped after the priority changed again", async () => {
    const ada = await world.person("Ada")
    const job = await saved(ada)
    const first = dataOf<Job>(
      await ada.run("job.setPriority", { jobId: job.id, priority: "high" })
    )
    await ada.run("job.setPriority", { jobId: job.id, priority: "low" })
    const undone = await ada.undo(String(first.activityId))
    expect(failureOf(undone)).toMatchObject({
      code: "CONFLICT",
      message: "This priority changed again, so Undo was skipped",
    })
    expect((await jobOf(ada, job.id)).priority).toBe("low")
  })
})

describe("Undo of an addition never erases a later change", () => {
  it("skips Undo of adding a Job once the Job changed", async () => {
    const ada = await world.person("Ada")
    const job = await saved(ada)
    await ada.run("job.update", { jobId: job.id, patch: { location: "Hue" } })
    const undone = await ada.undo(String(job.activityId))
    expect(failureOf(undone)).toMatchObject({
      code: "CONFLICT",
      message: "This job changed after it was saved, so Undo was skipped",
    })
    expect((await jobOf(ada, job.id)).location).toBe("Hue")
  })

  it("skips Undo of adding a checklist item once the item changed", async () => {
    const ada = await world.person("Ada")
    const job = await saved(ada)
    const item = dataOf<Item & { activityId?: string | null }>(
      await ada.run("job.addChecklistItem", { jobId: job.id, label: "Call" })
    )
    await ada.run("job.setChecklistItem", {
      jobId: job.id,
      itemId: item.id,
      done: true,
    })
    const undone = await ada.undo(String(item.activityId))
    expect(failureOf(undone)).toMatchObject({
      code: "CONFLICT",
      message: "This checklist item changed again, so Undo was skipped",
    })
  })
})

describe("a Word page links to a Job like any Paper", () => {
  it("links a Word page started for the Job, and one started alone", async () => {
    const ada = await world.person("Ada")
    const job = await saved(ada)
    const forJob = dataOf<{ docId: string }>(
      await ada.run(
        "paper.start",
        { kind: "cv", name: "Word CV", jobId: job.id },
        "word-cv-for-job"
      )
    )
    expect((await jobOf(ada, job.id)).cvDocId).toBe(forJob.docId)
    const alone = dataOf<{ docId: string }>(
      await ada.run(
        "paper.start",
        { kind: "letter", name: "Word Letter" },
        "word-letter-alone"
      )
    )
    await ada.run("job.linkPaper", {
      jobId: job.id,
      docId: alone.docId,
      kind: "letter",
    })
    const detail = await jobOf(ada, job.id)
    expect(detail.letterDocId).toBe(alone.docId)
    expect(detail.linked).toEqual({
      cv: { id: forJob.docId, name: "Word CV" },
      letter: { id: alone.docId, name: "Word Letter" },
    })
  })
})
