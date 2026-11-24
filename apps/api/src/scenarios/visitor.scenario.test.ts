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
  it("reads a Paper its owner shared", async () => {
    const ada = await world.person("Ada")
    const paper = dataOf<{ id: string }>(
      await ada.run("paper.create", { kind: "cv", name: "Marketing CV" })
    )
    const share = dataOf<{ token: string }>(
      await ada.run("paper.share", { docId: paper.id })
    )
    const shared = await world.visitor().get(`/api/paper/shared/${share.token}`)
    expect(shared.status).toBe(200)
    expect(dataOf<{ name: string }>(shared).name).toBe("Marketing CV")
  })

  it("does not find a Paper nobody shared", async () => {
    const shared = await world
      .visitor()
      .get("/api/paper/shared/not-a-real-share-token")
    expect(shared.ok).toBe(false)
    expect(shared.error?.code).toBe("NOT_FOUND")
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
