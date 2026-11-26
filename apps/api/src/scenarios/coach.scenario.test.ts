import type { CoachStreamPart, CoachTurnInput } from "@workspace/domain/coach"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createScriptedCoachRuntime } from "../coach/index.js"
import {
  dataOf,
  failureOf,
  openWorld,
  type Person,
  type World,
} from "./person.test-support.js"

type Part = {
  type: string
  name?: string
  pendingActionId?: string
  approval?: string
}

type Chat = {
  id: string
  title: string
  messages: { role: string; text: string; status: string; parts: Part[] }[]
}

function asked(input: CoachTurnInput) {
  return String(input.history.at(-1)?.text ?? "")
}

async function* coach(input: CoachTurnInput): AsyncGenerator<CoachStreamPart> {
  const text = asked(input)
  const jobId = text.match(/[0-9a-f-]{36}/)?.[0]
  yield { type: "text-delta", text: "On it." }
  if (text.startsWith("move") && input.execute) {
    const move = { jobId, stage: "applied" }
    yield {
      type: "tool-call",
      toolCallId: "call_1",
      name: "job.move",
      input: move,
    }
    await input.execute({ name: "job.move", input: move })
  }
  yield { type: "finish", finishReason: "stop", usage: { model: "fake" } }
}

let world: World

beforeAll(async () => {
  world = await openWorld({ coach: createScriptedCoachRuntime(coach) })
})

afterAll(async () => {
  await world.close()
})

async function newChat(person: Person) {
  return dataOf<Chat>(await person.run("chat.create", {}))
}

async function chatOf(person: Person, chatId: string) {
  return dataOf<Chat>(await person.read("chat.get", { chatId: chatId }))
}

async function say(person: Person, chatId: string, text: string) {
  await person.stream(`/api/chats/${chatId}/turns`, { text })
  return chatOf(person, chatId)
}

async function savedJob(person: Person) {
  return dataOf<{ id: string; stage: string }>(
    await person.run("job.create", { title: "Intern", company: "Northwind" })
  )
}

function proposalIn(chat: Chat) {
  return chat.messages
    .flatMap((message) => message.parts)
    .find((part) => part.pendingActionId)
}

describe("a Chat", () => {
  it("starts empty, is called New chat, and is listed for its owner only", async () => {
    const ada = await world.person("Ada")
    const grace = await world.person("Grace")
    const chat = await newChat(ada)
    expect(chat).toMatchObject({ title: "New chat", messages: [] })
    expect(
      dataOf<{ id: string }[]>(await ada.read("chat.list", {})).map((c) => c.id)
    ).toEqual([chat.id])
    expect(dataOf<unknown[]>(await grace.read("chat.list", {}))).toEqual([])
    expect(
      failureOf(await grace.read("chat.get", { chatId: chat.id })).code
    ).toBe("NOT_FOUND")
  })

  it("keeps the person's message and the Coach's reply, in order", async () => {
    const ada = await world.person("Ada")
    const chat = await say(ada, (await newChat(ada)).id, "hello")
    expect(
      chat.messages.map((message) => [message.role, message.status])
    ).toEqual([
      ["person", "final"],
      ["coach", "final"],
    ])
    expect(chat.messages[0]?.text).toBe("hello")
    expect(chat.messages[1]?.text).toContain("On it.")
  })

  it("can be renamed and deleted by its owner", async () => {
    const ada = await world.person("Ada")
    const chat = await newChat(ada)
    await ada.run("chat.rename", { chatId: chat.id, title: "Interview prep" })
    expect((await chatOf(ada, chat.id)).title).toBe("Interview prep")
    await ada.run("chat.delete", { chatId: chat.id })
    expect(
      failureOf(await ada.read("chat.get", { chatId: chat.id })).code
    ).toBe("NOT_FOUND")
  })

  it("has nothing to stop when the Coach is not working", async () => {
    const ada = await world.person("Ada")
    const chat = await newChat(ada)
    expect(
      dataOf<{ stopped: boolean }>(
        await ada.run("coach.stop", { chatId: chat.id })
      ).stopped
    ).toBe(false)
  })
})

describe("the Coach acting for the person", () => {
  it("proposes a change that needs a yes, and runs it once when the person approves", async () => {
    const ada = await world.person("Ada")
    const job = await savedJob(ada)
    const chat = await say(ada, (await newChat(ada)).id, `move ${job.id}`)
    const proposal = proposalIn(chat)
    expect(proposal).toMatchObject({ name: "job.move", approval: "pending" })
    const stage = async () =>
      dataOf<{ stage: string }>(await ada.read("job.get", { jobId: job.id }))
        .stage
    expect(await stage()).toBe("saved")
    const approve = () =>
      ada.run("actions.approve", {
        pendingActionId: proposal?.pendingActionId,
      })
    expect((await approve()).status).toBe(200)
    expect(await stage()).toBe("applied")
    expect((await approve()).status).toBe(200)
    expect(await stage()).toBe("applied")
  })

  it("leaves things as they were when the person denies a proposal", async () => {
    const ada = await world.person("Ada")
    const job = await savedJob(ada)
    const chat = await say(ada, (await newChat(ada)).id, `move ${job.id}`)
    const denied = await ada.run("actions.deny", {
      pendingActionId: proposalIn(chat)?.pendingActionId,
    })
    expect(denied.status).toBe(200)
    expect(
      dataOf<{ stage: string }>(await ada.read("job.get", { jobId: job.id }))
        .stage
    ).toBe("saved")
    const approval = await ada.run("actions.approve", {
      pendingActionId: proposalIn(chat)?.pendingActionId,
    })
    expect(
      dataOf<{ stage: string }>(await ada.read("job.get", { jobId: job.id }))
        .stage
    ).toBe("saved")
    expect(approval.ok && approval.data !== null).toBe(false)
  })
})
