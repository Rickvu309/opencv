import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { dataOf, openWorld, type World } from "./person.test-support.js"

let world: World

beforeAll(async () => {
  world = await openWorld()
})

afterAll(async () => {
  await world.close()
})

describe("a visitor, who is not signed in", () => {
  it("opens no Paper, since a Paper is never public", async () => {
    const ada = await world.person("Ada")
    const paper = dataOf<{ id: string }>(
      await ada.run("paper.create", { kind: "cv", name: "Marketing CV" })
    )
    const opened = await world.visitor().get(`/api/paper/${paper.id}/document`)
    expect(opened.status).toBe(401)
  })

  it("is refused every read that does not say a visitor may", async () => {
    const visitor = world.visitor()
    for (const name of ["job.list", "paper.list", "profile.get"])
      await expect(visitor.ask(name, {})).rejects.toThrow(
        "Sign in to read this"
      )
  })

  it("is refused every command", async () => {
    const res = await world.visitor().post("/api/commands/job.create", {
      input: { title: "Intern", company: "Northwind" },
    })
    expect(res.status).toBe(401)
  })
})
