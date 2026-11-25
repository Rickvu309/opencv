import { afterAll, beforeAll, describe, expect, it } from "vitest"

import {
  dataOf,
  failureOf,
  openWorld,
  type World,
} from "./person.test-support.js"

type Profile = {
  name: string
  email: string
  plan: string
  coachMode: string
  language: string
  timeZone: string
  startPage: string
  notifyEmail: boolean
  notifyBrowser: boolean
  memoryEnabled: boolean
  welcomedAt: string | null
}

type Receipt = {
  id: string
  summary: string
  command: string
  undoneAt: string | null
}

let world: World

beforeAll(async () => {
  world = await openWorld()
})

afterAll(async () => {
  await world.close()
})

describe("a person's profile", () => {
  it("starts on the Free plan with the defaults", async () => {
    const ada = await world.person("Ada")
    const profile = dataOf<Profile>(await ada.read("profile.get", {}))
    expect(profile).toMatchObject({
      name: "Ada",
      plan: "free",
      coachMode: "free",
      language: "en",
      startPage: "apply",
      notifyEmail: true,
      notifyBrowser: false,
      memoryEnabled: true,
    })
  })

  it("changes only the settings named, and keeps no receipt", async () => {
    const ada = await world.person("Ada")
    const updated = dataOf<Profile & { activityId?: string }>(
      await ada.run("profile.update", {
        name: "Ada Lovelace",
        startPage: "paper",
        notifyBrowser: true,
      })
    )
    expect(updated.activityId ?? null).toBeNull()
    expect(dataOf<Profile>(await ada.read("profile.get", {}))).toMatchObject({
      name: "Ada Lovelace",
      startPage: "paper",
      notifyBrowser: true,
      language: "en",
      notifyEmail: true,
    })
  })

  it("refuses a Coach mode above Free on the Free plan", async () => {
    const ada = await world.person("Ada")
    const refused = failureOf(
      await ada.run("profile.update", { coachMode: "max" })
    )
    expect(refused.message).toBe(
      "Light and Max need Pro. Stay on Free, or upgrade to change mode."
    )
    expect(dataOf<Profile>(await ada.read("profile.get", {})).coachMode).toBe(
      "free"
    )
  })

  it("refuses a time zone that does not exist", async () => {
    const ada = await world.person("Ada")
    expect(
      (await ada.run("profile.update", { timeZone: "Mars/Olympus" })).ok
    ).toBe(false)
  })

  it("records that the person has been welcomed", async () => {
    const ada = await world.person("Ada")
    expect(
      dataOf<Profile>(await ada.read("profile.get", {})).welcomedAt ?? null
    ).toBeNull()
    await ada.run("profile.markWelcomed", {})
    expect(
      dataOf<Profile>(await ada.read("profile.get", {})).welcomedAt
    ).toEqual(expect.any(String))
  })

  it("belongs to one person", async () => {
    const ada = await world.person("Ada")
    const grace = await world.person("Grace")
    await ada.run("profile.update", { name: "Ada Changed" })
    expect(dataOf<Profile>(await grace.read("profile.get", {})).name).toBe(
      "Grace"
    )
  })
})

describe("a person's plan", () => {
  it("is Free until they upgrade", async () => {
    const ada = await world.person("Ada")
    expect(
      dataOf<{ plan: string }>(await ada.read("billing.get", {})).plan
    ).toBe("free")
  })
})

describe("asking to be told when something opens", () => {
  it("keeps one request per topic, however often it is asked", async () => {
    const ada = await world.person("Ada")
    const first = dataOf<{ id: string; topic: string }>(
      await ada.run("notify.request", { topic: "pitch" })
    )
    const again = dataOf<{ id: string }>(
      await ada.run("notify.request", { topic: "pitch" })
    )
    const other = dataOf<{ id: string }>(
      await ada.run("notify.request", { topic: "jobs" })
    )
    expect(first.topic).toBe("pitch")
    expect(again.id).toBe(first.id)
    expect(other.id).not.toBe(first.id)
  })
})

describe("a person's activity", () => {
  it("lists the receipts for one thing and shows which were undone", async () => {
    const ada = await world.person("Ada")
    const job = dataOf<{ id: string }>(
      await ada.run("job.create", { title: "Intern", company: "Northwind" })
    )
    const starred = dataOf<{ activityId: string }>(
      await ada.run("job.star", { jobId: job.id, starred: true })
    )
    await ada.undo(starred.activityId)
    const receipts = dataOf<Receipt[]>(
      await ada.read("activity.list", { subjectKind: "job", subjectId: job.id })
    )
    const summaries = receipts.map((receipt) => receipt.summary)
    expect(summaries).toContain("You added this job from the board")
    expect(summaries).toContain("You starred it")
    expect(
      receipts.find((receipt) => receipt.id === starred.activityId)?.undoneAt
    ).toEqual(expect.any(String))
  })

  it("is not shown to anyone else", async () => {
    const ada = await world.person("Ada")
    const grace = await world.person("Grace")
    const job = dataOf<{ id: string }>(
      await ada.run("job.create", { title: "Intern", company: "Northwind" })
    )
    expect(
      dataOf<Receipt[]>(
        await grace.read("activity.list", {
          subjectKind: "job",
          subjectId: job.id,
        })
      )
    ).toEqual([])
  })
})

describe("deleting an account", () => {
  it("needs the word DELETE", async () => {
    const ada = await world.person("Ada")
    expect((await ada.run("account.delete", { confirm: "yes" })).ok).toBe(false)
    expect((await ada.read("profile.get", {})).status).toBe(200)
  })

  it("signs the person out and removes what they made", async () => {
    const ada = await world.person("Ada")
    const job = dataOf<{ id: string }>(
      await ada.run("job.create", { title: "Intern", company: "Northwind" })
    )
    expect(
      (await ada.run("account.delete", { confirm: "DELETE" })).status
    ).toBe(200)
    expect((await ada.read("profile.get", {})).status).toBe(401)
    expect((await ada.read("job.get", { jobId: job.id })).status).toBe(401)
  })
})
