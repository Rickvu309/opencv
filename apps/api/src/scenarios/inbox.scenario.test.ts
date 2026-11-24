import { afterAll, beforeAll, describe, expect, it } from "vitest"

import {
  dataOf,
  openWorld,
  type Person,
  type World,
} from "./person.test-support.js"

type Thread = {
  id: string
  company: string
  summary: string
  lastMessageAt: string
  status: string
}

type Inbox = { connected: boolean; skipped: boolean; threads: Thread[] }

type Detail = Thread & {
  subject: string
  messages: { direction: string; sentAt: string }[]
  draft: { body: string } | null
}

let world: World

beforeAll(async () => {
  world = await openWorld()
})

afterAll(async () => {
  await world.close()
})

async function inbox(person: Person) {
  return dataOf<Inbox>(await person.get("/api/inbox"))
}

async function scanned(person: Person) {
  await person.run("inbox.scan", {})
  return (await inbox(person)).threads
}

describe("reading recruiter mail", () => {
  it("is empty until mail is read in", async () => {
    const ada = await world.person("Ada")
    expect((await inbox(ada)).threads).toEqual([])
  })

  it("lists each thread once, newest first, however often mail is read in", async () => {
    const ada = await world.person("Ada")
    const first = await scanned(ada)
    const again = await scanned(ada)
    expect(first.length).toBeGreaterThan(0)
    expect(again.map((thread) => thread.id)).toEqual(
      first.map((thread) => thread.id)
    )
    const times = first.map((thread) => thread.lastMessageAt)
    expect(times).toEqual([...times].sort().reverse())
  })

  it("shows a thread's messages in the order they were sent, with a drafted reply", async () => {
    const ada = await world.person("Ada")
    const [thread] = await scanned(ada)
    const detail = dataOf<Detail>(await ada.get(`/api/inbox/${thread?.id}`))
    expect(detail.subject.length).toBeGreaterThan(0)
    const sent = detail.messages.map((message) => message.sentAt)
    expect(sent).toEqual([...sent].sort())
    expect(detail.draft?.body.length).toBeGreaterThan(0)
  })

  it("belongs to one person", async () => {
    const ada = await world.person("Ada")
    const grace = await world.person("Grace")
    const [thread] = await scanned(ada)
    expect((await inbox(grace)).threads).toEqual([])
    expect((await grace.get(`/api/inbox/${thread?.id}`)).ok).toBe(false)
  })
})

describe("working through mail", () => {
  it("takes a thread off the list when it is marked done, and Undo puts it back", async () => {
    const ada = await world.person("Ada")
    const [thread] = await scanned(ada)
    const done = dataOf<{ activityId?: string }>(
      await ada.run("inbox.markDone", { threadId: thread?.id })
    )
    expect((await inbox(ada)).threads.map((open) => open.id)).not.toContain(
      thread?.id
    )
    await ada.undo(String(done.activityId))
    expect((await inbox(ada)).threads.map((open) => open.id)).toContain(
      thread?.id
    )
  })

  it("moves a snoozed thread to the snoozed list until its time", async () => {
    const ada = await world.person("Ada")
    const [thread] = await scanned(ada)
    await ada.run("inbox.snooze", {
      threadId: thread?.id,
      until: "2099-01-01T00:00:00.000Z",
    })
    expect((await inbox(ada)).threads.map((open) => open.id)).not.toContain(
      thread?.id
    )
    const snoozed = dataOf<Inbox>(await ada.get("/api/inbox/snoozed"))
    expect(snoozed.threads.map((later) => later.id)).toContain(thread?.id)
    await ada.run("inbox.snooze", { threadId: thread?.id, until: null })
    expect((await inbox(ada)).threads.map((open) => open.id)).toContain(
      thread?.id
    )
  })

  it("keeps the reply the person edited", async () => {
    const ada = await world.person("Ada")
    const [thread] = await scanned(ada)
    await ada.run("inbox.updateDraft", {
      threadId: thread?.id,
      body: "Thursday at 15:00 works for me.",
    })
    const detail = dataOf<Detail>(await ada.get(`/api/inbox/${thread?.id}`))
    expect(detail.draft?.body).toBe("Thursday at 15:00 works for me.")
  })

  it("remembers that the person skipped connecting their mail", async () => {
    const ada = await world.person("Ada")
    expect((await inbox(ada)).skipped).toBe(false)
    await ada.run("inbox.skip", {})
    expect((await inbox(ada)).skipped).toBe(true)
  })
})
