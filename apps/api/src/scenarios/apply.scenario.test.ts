import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { board, jobOf, saved, type Job } from "./apply.test-support.js"
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

describe("saving a Job", () => {
  it("puts a new Job in saved with normal priority and no star", async () => {
    const ada = await world.person("Ada")
    const job = await saved(ada, { location: "Hanoi" })
    expect(job).toMatchObject({
      title: "Intern",
      company: "Northwind",
      stage: "saved",
      priority: "normal",
      location: "Hanoi",
      starred: false,
    })
    expect(await board(ada)).toHaveLength(1)
  })

  it("refuses a Job with no company and says how to fix it", async () => {
    const ada = await world.person("Ada")
    const refused = failureOf(await ada.run("job.create", { title: "Intern" }))
    expect(refused.code).toBe("COMPANY_REQUIRED")
    expect(refused.message).toBe("Add the company name to save this job.")
    expect(await board(ada)).toHaveLength(0)
  })

  it("refuses the same link twice, whatever its case, trailing slash or fragment", async () => {
    const ada = await world.person("Ada")
    const first = await saved(ada, {
      jobUrl: "https://careers.example.com/intern",
    })
    const refused = failureOf(
      await ada.run("job.create", {
        title: "Intern again",
        company: "Northwind",
        jobUrl: "https://CAREERS.example.com/intern/#apply",
      })
    )
    expect(refused.code).toBe("DUPLICATE_JOB")
    expect(refused.message).toBe("You already saved a job with this link.")
    const all = await board(ada)
    expect(all.map((job) => job.id)).toEqual([first.id])
  })

  it("saves the same link again when the person says anyway", async () => {
    const ada = await world.person("Ada")
    const jobUrl = "https://careers.example.com/anyway"
    await saved(ada, { jobUrl })
    await saved(ada, { jobUrl, anyway: true })
    expect(await board(ada)).toHaveLength(2)
  })

  it("names where the Job came from: the link's site, or the board", async () => {
    const ada = await world.person("Ada")
    const linked = await saved(ada, {
      jobUrl: "https://jobs.example.org/roles/1",
    })
    expect(linked.sourceHost).toBe("jobs.example.org")
    const typed = await saved(ada, { title: "Typed" })
    expect(typed.sourceHost).toBeNull()
  })

  it("puts each new Job after the others in its stage", async () => {
    const ada = await world.person("Ada")
    const first = await saved(ada, { title: "First" })
    const second = await saved(ada, { title: "Second" })
    const third = await saved(ada, { title: "Third", stage: "applied" })
    expect(first.position < second.position).toBe(true)
    expect((await board(ada)).map((job) => job.title)).toEqual(
      [first, second, third]
        .sort((a, b) => (a.position < b.position ? -1 : 1))
        .map((job) => job.title)
    )
  })

  it("is undone by Undo, which removes the Job", async () => {
    const ada = await world.person("Ada")
    const job = await saved(ada)
    expect(job.activityId).toEqual(expect.any(String))
    expect((await ada.undo(String(job.activityId))).status).toBe(200)
    expect(failureOf(await ada.get(`/api/jobs/${job.id}`)).code).toBe(
      "NOT_FOUND"
    )
  })

  it("runs once for one key, however often it is sent", async () => {
    const ada = await world.person("Ada")
    const input = { title: "Intern", company: "Northwind" }
    const first = dataOf<Job>(await ada.run("job.create", input, "one-key"))
    const again = dataOf<Job>(await ada.run("job.create", input, "one-key"))
    expect(again.id).toBe(first.id)
    expect(await board(ada)).toHaveLength(1)
  })
})

describe("a Job belongs to one person", () => {
  it("is not found by anyone else, for reading or changing", async () => {
    const ada = await world.person("Ada")
    const grace = await world.person("Grace")
    const job = await saved(ada)
    expect(failureOf(await grace.get(`/api/jobs/${job.id}`)).code).toBe(
      "NOT_FOUND"
    )
    expect(
      failureOf(await grace.run("job.star", { jobId: job.id, starred: true }))
        .code
    ).toBe("NOT_FOUND")
    expect(
      failureOf(await grace.run("job.delete", { jobId: job.id })).code
    ).toBe("NOT_FOUND")
    expect(await board(grace)).toHaveLength(0)
    expect((await jobOf(ada, job.id)).starred).toBe(false)
  })
})

describe("changing a Job's facts", () => {
  it("changes only the named facts, and Undo puts the old ones back", async () => {
    const ada = await world.person("Ada")
    const job = await saved(ada, { location: "Hanoi" })
    const updated = dataOf<Job>(
      await ada.run("job.update", {
        jobId: job.id,
        patch: {
          location: "Da Nang",
          deadline: "2027-01-15",
          recruiterName: "Lan",
        },
      })
    )
    expect(updated).toMatchObject({
      title: "Intern",
      location: "Da Nang",
      deadline: "2027-01-15",
      recruiterName: "Lan",
    })
    await ada.undo(String(updated.activityId))
    expect(await jobOf(ada, job.id)).toMatchObject({
      location: "Hanoi",
      deadline: null,
      recruiterName: null,
    })
  })

  it("keeps no receipt for a change to the title alone", async () => {
    const ada = await world.person("Ada")
    const job = await saved(ada)
    const renamed = dataOf<Job>(
      await ada.run("job.update", {
        jobId: job.id,
        patch: { title: "Product intern" },
      })
    )
    expect(renamed.title).toBe("Product intern")
    expect(renamed.activityId ?? null).toBeNull()
  })

  it("refuses a link another of the person's Jobs already has", async () => {
    const ada = await world.person("Ada")
    await saved(ada, { jobUrl: "https://careers.example.com/taken" })
    const other = await saved(ada, { title: "Other" })
    const refused = failureOf(
      await ada.run("job.update", {
        jobId: other.id,
        patch: { jobUrl: "https://careers.example.com/taken/" },
      })
    )
    expect(refused.code).toBe("DUPLICATE_JOB")
  })

  it("sets priority through an update, and Undo restores it", async () => {
    const ada = await world.person("Ada")
    const job = await saved(ada)
    const raised = dataOf<Job>(
      await ada.run("job.update", {
        jobId: job.id,
        patch: { priority: "high" },
      })
    )
    expect(raised.priority).toBe("high")
    await ada.undo(String(raised.activityId))
    expect((await jobOf(ada, job.id)).priority).toBe("normal")
  })
})

describe("priority", () => {
  it("is set by its own command and counted across the person's Jobs", async () => {
    const ada = await world.person("Ada")
    const job = await saved(ada)
    await saved(ada, { title: "Second" })
    const raised = dataOf<Job>(
      await ada.run("job.setPriority", { jobId: job.id, priority: "high" })
    )
    expect(raised.priority).toBe("high")
    expect(
      dataOf<{ priority: string; count: number }[]>(
        await ada.read("job.priorityCounts", {})
      )
    ).toEqual([
      { priority: "low", count: 0 },
      { priority: "normal", count: 1 },
      { priority: "high", count: 1 },
    ])
    await ada.undo(String(raised.activityId))
    expect((await jobOf(ada, job.id)).priority).toBe("normal")
  })
})

describe("moving a Job between stages", () => {
  it("moves it to the end of the new stage, and Undo moves it back", async () => {
    const ada = await world.person("Ada")
    const waiting = await saved(ada, { title: "Waiting", stage: "applied" })
    const job = await saved(ada)
    const moved = dataOf<Job>(
      await ada.run("job.move", { jobId: job.id, stage: "applied" })
    )
    expect(moved.stage).toBe("applied")
    expect(waiting.position < moved.position).toBe(true)
    await ada.undo(String(moved.activityId))
    expect(await jobOf(ada, job.id)).toMatchObject({
      stage: "saved",
      position: job.position,
    })
  })

  it("takes the place the person dropped it on", async () => {
    const ada = await world.person("Ada")
    const job = await saved(ada)
    const moved = dataOf<Job>(
      await ada.run("job.move", {
        jobId: job.id,
        stage: "interview",
        position: "a0V",
      })
    )
    expect(moved).toMatchObject({ stage: "interview", position: "a0V" })
  })

  it("skips Undo when the Job has moved again since", async () => {
    const ada = await world.person("Ada")
    const job = await saved(ada)
    const first = dataOf<Job>(
      await ada.run("job.move", { jobId: job.id, stage: "applied" })
    )
    await ada.run("job.move", { jobId: job.id, stage: "interview" })
    await ada.undo(String(first.activityId))
    expect((await jobOf(ada, job.id)).stage).toBe("interview")
  })
})

describe("starring and deleting", () => {
  it("stars and unstars, and Undo restores the earlier state", async () => {
    const ada = await world.person("Ada")
    const job = await saved(ada)
    const starred = dataOf<Job>(
      await ada.run("job.star", { jobId: job.id, starred: true })
    )
    expect(starred.starred).toBe(true)
    await ada.undo(String(starred.activityId))
    expect((await jobOf(ada, job.id)).starred).toBe(false)
  })

  it("deletes for good: no receipt, no Undo, and the Job is not found", async () => {
    const ada = await world.person("Ada")
    const job = await saved(ada)
    await ada.run("job.addChecklistItem", { jobId: job.id, label: "Research" })
    const deleted = dataOf<{ id: string; activityId?: string | null }>(
      await ada.run("job.delete", { jobId: job.id })
    )
    expect(deleted.id).toBe(job.id)
    expect(deleted.activityId ?? null).toBeNull()
    expect(failureOf(await ada.get(`/api/jobs/${job.id}`)).code).toBe(
      "NOT_FOUND"
    )
    expect(await board(ada)).toHaveLength(0)
  })
})
