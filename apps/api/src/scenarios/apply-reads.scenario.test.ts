import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { board, saved, type Job } from "./apply.test-support.js"
import {
  dataOf,
  failureOf,
  openWorld,
  type Person,
  type World,
} from "./person.test-support.js"

type Preview = {
  status: string
  message?: string
  jobId?: string
  stage?: string
  fields: { title?: string; company?: string; location?: string }
}

const POSTING =
  "Northwind Labs is hiring an associate product manager intern in Hanoi."

const postings = new Map<string, string>()

let world: World

beforeAll(async () => {
  world = await openWorld({
    fetchJobPosting: async (url) => {
      const text = postings.get(url)
      return text
        ? { ok: true, text }
        : { ok: false, message: "We could not read that link." }
    },
  })
})

afterAll(async () => {
  await world.close()
})

describe("reading the board", () => {
  it("lists the person's Jobs in board order", async () => {
    const ada = await world.person("Ada")
    await saved(ada, { title: "One" })
    await saved(ada, { title: "Two" })
    const all = await board(ada)
    expect(all.map((job) => job.title)).toEqual(["One", "Two"])
  })

  it("narrows by stage, by part of the company and by part of the place", async () => {
    const ada = await world.person("Ada")
    await saved(ada, {
      title: "A",
      company: "Northwind Labs",
      location: "Hanoi",
    })
    await saved(ada, {
      title: "B",
      company: "Contoso",
      location: "Da Nang",
      stage: "applied",
    })
    const titles = async (filter: Record<string, string>) =>
      (await ada.ask<Job[]>("job.list", filter)).map((job) => job.title)
    expect(await titles({ stage: "applied" })).toEqual(["B"])
    expect(await titles({ company: "northwind" })).toEqual(["A"])
    expect(await titles({ location: "nang" })).toEqual(["B"])
    expect(await titles({ stage: "saved", company: "contoso" })).toEqual([])
  })

  it("lists Jobs with an interview or a deadline inside the dates asked for", async () => {
    const ada = await world.person("Ada")
    const interview = await saved(ada, { title: "Interview" })
    await ada.run("job.update", {
      jobId: interview.id,
      patch: { interviewAt: "2027-02-10T09:00:00.000Z" },
    })
    await saved(ada, { title: "Deadline", deadline: "2027-02-20" })
    await saved(ada, { title: "Later", deadline: "2027-06-01" })
    await saved(ada, { title: "Undated" })
    const inRange = dataOf<Job[]>(
      await ada.read("job.calendar", { from: "2027-02-01", to: "2027-02-28" })
    )
    expect(inRange.map((job) => job.title).sort()).toEqual([
      "Deadline",
      "Interview",
    ])
  })

  it("refuses a calendar range that is not two dates", async () => {
    const ada = await world.person("Ada")
    const refused = failureOf(
      await ada.read("job.calendar", { from: "nope", to: "also" })
    )
    expect(refused.code).toBe("VALIDATION_ERROR")
    expect(refused.message).toBe("Use a from and to date.")
  })

  it("refuses a Job id that is not an id", async () => {
    const ada = await world.person("Ada")
    expect(failureOf(await ada.get("/api/jobs/not-an-id")).code).toBe(
      "VALIDATION_ERROR"
    )
  })
})

describe("previewing a posting before saving", () => {
  const preview = async (person: Person, input: Record<string, string>) =>
    dataOf<Preview>(await person.read("job.preview", input))

  it("fills title, company and place from pasted text", async () => {
    const ada = await world.person("Ada")
    expect(await preview(ada, { text: POSTING })).toMatchObject({
      status: "filled",
      fields: {
        title: "associate product manager intern",
        company: "Northwind Labs",
        location: "Hanoi",
        description: POSTING,
      },
    })
  })

  it("reads the text behind a link", async () => {
    const ada = await world.person("Ada")
    postings.set("https://careers.example.com/readable", POSTING)
    expect(
      await preview(ada, { url: "https://careers.example.com/readable" })
    ).toMatchObject({
      status: "filled",
      fields: { company: "Northwind Labs" },
    })
  })

  it("says so when the company cannot be found", async () => {
    const ada = await world.person("Ada")
    expect(
      await preview(ada, { text: "A role with no company pattern." })
    ).toMatchObject({
      status: "company-missing",
      fields: { title: "", company: "", location: "" },
    })
  })

  it("says so when there is nothing to read", async () => {
    const ada = await world.person("Ada")
    expect(await preview(ada, {})).toEqual({
      status: "unreadable",
      fields: {},
      message: "Add a link or some text.",
    })
    expect(
      await preview(ada, { url: "https://careers.example.com/missing" })
    ).toEqual({
      status: "unreadable",
      fields: {},
      message: "We could not read that link.",
    })
  })

  it("points at the Job the person already saved from that link", async () => {
    const ada = await world.person("Ada")
    const job = await saved(ada, {
      stage: "interview",
      jobUrl: "https://careers.example.com/dupe",
    })
    expect(
      await preview(ada, {
        url: "https://careers.example.com/dupe",
        text: POSTING,
      })
    ).toMatchObject({ status: "duplicate", jobId: job.id, stage: "interview" })
  })
})
