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
  type World,
} from "./person.test-support.js"

let world: World

beforeAll(async () => {
  world = await openWorld()
})

afterAll(async () => {
  await world.close()
})

describe("a Job's checklist", () => {
  it("keeps items in the order they were added", async () => {
    const ada = await world.person("Ada")
    const job = await saved(ada)
    for (const label of ["Research", "Practise", "Follow up"])
      await ada.run("job.addChecklistItem", { jobId: job.id, label })
    const detail = await jobOf(ada, job.id)
    expect(detail.checklist.map((item) => item.label)).toEqual([
      "Research",
      "Practise",
      "Follow up",
    ])
    expect(detail.checklist.every((item) => !item.done)).toBe(true)
  })

  it("ticks and unticks an item, and Undo restores the tick", async () => {
    const ada = await world.person("Ada")
    const job = await saved(ada)
    const item = dataOf<Item>(
      await ada.run("job.addChecklistItem", { jobId: job.id, label: "Call" })
    )
    const ticked = dataOf<Item>(
      await ada.run("job.setChecklistItem", {
        jobId: job.id,
        itemId: item.id,
        done: true,
      })
    )
    expect((await jobOf(ada, job.id)).checklist[0]?.done).toBe(true)
    await ada.undo(String(ticked.activityId))
    expect((await jobOf(ada, job.id)).checklist[0]?.done).toBe(false)
  })

  it("removes an item, and Undo of adding one removes it too", async () => {
    const ada = await world.person("Ada")
    const job = await saved(ada)
    const kept = dataOf<Item>(
      await ada.run("job.addChecklistItem", { jobId: job.id, label: "Keep" })
    )
    const added = dataOf<Item>(
      await ada.run("job.addChecklistItem", { jobId: job.id, label: "Oops" })
    )
    await ada.undo(String(added.activityId))
    expect((await jobOf(ada, job.id)).checklist.map((i) => i.id)).toEqual([
      kept.id,
    ])
    await ada.run("job.removeChecklistItem", {
      jobId: job.id,
      itemId: kept.id,
    })
    expect((await jobOf(ada, job.id)).checklist).toEqual([])
  })

  it("does not find an item that is not on this Job", async () => {
    const ada = await world.person("Ada")
    const job = await saved(ada)
    const other = await saved(ada, { title: "Other" })
    const item = dataOf<Item>(
      await ada.run("job.addChecklistItem", { jobId: other.id, label: "Call" })
    )
    const refused = failureOf(
      await ada.run("job.setChecklistItem", {
        jobId: job.id,
        itemId: item.id,
        done: true,
      })
    )
    expect(refused.code).toBe("NOT_FOUND")
    expect(refused.message).toBe("Checklist item not found")
  })
})

describe("a Job's note", () => {
  it("shows the latest note the person wrote", async () => {
    const ada = await world.person("Ada")
    const job = await saved(ada)
    expect((await jobOf(ada, job.id)).note).toBe("")
    await ada.run("job.addNote", { jobId: job.id, body: "Ask about the team" })
    await ada.run("job.addNote", { jobId: job.id, body: "Lan replied" })
    expect((await jobOf(ada, job.id)).note).toBe("Lan replied")
  })
})

describe("the Papers sent for a Job", () => {
  it("links a CV and a Letter and shows each by name", async () => {
    const ada = await world.person("Ada")
    const job = await saved(ada)
    const cv = await paper(ada, "cv", "Marketing CV")
    const letter = await paper(ada, "letter", "Letter to Northwind")
    await ada.run("job.linkPaper", { jobId: job.id, docId: cv.id, kind: "cv" })
    await ada.run("job.linkPaper", {
      jobId: job.id,
      docId: letter.id,
      kind: "letter",
    })
    const detail = await jobOf(ada, job.id)
    expect(detail.linked).toEqual({
      cv: { id: cv.id, name: "Marketing CV" },
      letter: { id: letter.id, name: "Letter to Northwind" },
    })
    expect(detail).toMatchObject({ cvDocId: cv.id, letterDocId: letter.id })
  })

  it("does not find a Paper of the wrong kind or another person's Paper", async () => {
    const ada = await world.person("Ada")
    const grace = await world.person("Grace")
    const job = await saved(ada)
    const letter = await paper(ada, "letter", "A letter")
    const theirs = await paper(grace, "cv", "Grace CV")
    for (const docId of [letter.id, theirs.id]) {
      const refused = failureOf(
        await ada.run("job.linkPaper", { jobId: job.id, docId, kind: "cv" })
      )
      expect(refused.code).toBe("NOT_FOUND")
      expect(refused.message).toBe("Document not found")
    }
    expect((await jobOf(ada, job.id)).linked.cv).toBeNull()
  })

  it("replaces a linked CV, and Undo links the earlier one again", async () => {
    const ada = await world.person("Ada")
    const job = await saved(ada)
    const first = await paper(ada, "cv", "First CV")
    const second = await paper(ada, "cv", "Second CV")
    await ada.run("job.linkPaper", {
      jobId: job.id,
      docId: first.id,
      kind: "cv",
    })
    const replaced = dataOf<Job>(
      await ada.run("job.linkPaper", {
        jobId: job.id,
        docId: second.id,
        kind: "cv",
      })
    )
    expect(replaced.cvDocId).toBe(second.id)
    await ada.undo(String(replaced.activityId))
    expect((await jobOf(ada, job.id)).linked.cv?.name).toBe("First CV")
  })

  it("unlinks, and Undo of a first link unlinks too", async () => {
    const ada = await world.person("Ada")
    const job = await saved(ada)
    const cv = await paper(ada, "cv", "Marketing CV")
    const linked = dataOf<Job>(
      await ada.run("job.linkPaper", {
        jobId: job.id,
        docId: cv.id,
        kind: "cv",
      })
    )
    await ada.undo(String(linked.activityId))
    expect((await jobOf(ada, job.id)).linked.cv).toBeNull()
    await ada.run("job.linkPaper", { jobId: job.id, docId: cv.id, kind: "cv" })
    const unlinked = dataOf<Job>(
      await ada.run("job.unlinkPaper", { jobId: job.id, kind: "cv" })
    )
    expect(unlinked.cvDocId).toBeNull()
  })
})
