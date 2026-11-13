import { describe, expect, it } from "vitest"

import {
  L,
  START,
  bar,
  goOnline,
  opened,
  reload,
  server,
  settle,
  status,
  type,
  openUnsavedPageSuite,
} from "@/test/paper-page-unsaved.tsx"

openUnsavedPageSuite()

async function lostReplyOn(text: string) {
  await opened()
  server.state.loseReplies = 1
  await type(L.job, text)
  await settle()
  expect(server.textOf(L.job)).toBe(`${START[L.job]}${text}`)
  expect(status()).not.toMatch(/\bSaved\b/)
}

describe("a save whose reply was lost", () => {
  it("is recognised as the page's own save when the person keeps typing", async () => {
    await lostReplyOn(" A")
    const posts = server.state.posts
    await type(L.job, " B")
    await settle()
    expect(bar()).toBeNull()
    expect(server.textOf(L.job)).toBe(`${START[L.job]} A B`)
    expect(server.state.posts).toBe(posts + 1)
    expect(status()).toMatch(/\bSaved\b/)
  })

  it("is recognised after a reload when nothing was typed after it", async () => {
    await lostReplyOn(" A")
    await reload()
    expect(bar()).toBeNull()
    expect(status()).toMatch(/\bSaved\b/)
    await type(L.name, "Q")
    await settle()
    expect(server.textOf(L.name)).toBe(`${START[L.name]}Q`)
  })

  it.fails(
    "is recognised after a reload when the person typed more offline before it (seed 1072 class, #1452)",
    async () => {
      await lostReplyOn(" A")
      server.state.offline = true
      await type(L.job, " B")
      await settle()
      await reload()
      await goOnline()
      expect(bar()).toBeNull()
      await type(L.name, "Q")
      await settle()
      expect(server.textOf(L.name)).toBe(`${START[L.name]}Q`)
      expect(server.textOf(L.job)).toBe(`${START[L.job]} A B`)
    }
  )
})
