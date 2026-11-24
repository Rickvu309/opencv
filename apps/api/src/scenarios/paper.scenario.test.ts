import { RICH_NATIVE_WRITER } from "@workspace/domain"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import {
  dataOf,
  failureOf,
  openWorld,
  type Person,
  type World,
} from "./person.test-support.js"

type Paper = { id: string; name: string; kind: string; format: string }

const writer = RICH_NATIVE_WRITER
const asEditor = { "x-paper-writer": JSON.stringify(writer) }

let world: World

beforeAll(async () => {
  world = await openWorld()
})

afterAll(async () => {
  await world.close()
})

async function blank(person: Person, kind: "cv" | "letter", name: string) {
  return dataOf<Paper & { activityId?: string }>(
    await person.run("paper.create", { kind, name, format: "rich" })
  )
}

function opened(person: Person, docId: string) {
  return person.get(`/api/paper/${docId}/document`, asEditor)
}

describe("a Paper started blank", () => {
  it("is a CV or a Letter with the name the person gave it", async () => {
    const ada = await world.person("Ada")
    const cv = await blank(ada, "cv", "Marketing CV")
    const letter = await blank(ada, "letter", "Letter to Northwind")
    expect(cv.activityId).toEqual(expect.any(String))
    expect(dataOf<Paper>(await opened(ada, cv.id))).toMatchObject({
      name: "Marketing CV",
      kind: "cv",
      format: "rich",
    })
    expect(dataOf<Paper>(await opened(ada, letter.id))).toMatchObject({
      name: "Letter to Northwind",
      kind: "letter",
    })
  })

  it("belongs to one person", async () => {
    const ada = await world.person("Ada")
    const grace = await world.person("Grace")
    const cv = await blank(ada, "cv", "Marketing CV")
    expect(failureOf(await opened(grace, cv.id)).code).toBe("NOT_FOUND")
  })

  it("is marked and unmarked as a favourite", async () => {
    const ada = await world.person("Ada")
    const cv = await blank(ada, "cv", "Marketing CV")
    for (const isFavorite of [true, false])
      expect(
        dataOf<{ isFavorite: boolean }>(
          await ada.run("paper.setFavorite", { docId: cv.id, isFavorite })
        ).isFavorite
      ).toBe(isFavorite)
  })

  it("is not found once it is deleted", async () => {
    const ada = await world.person("Ada")
    const cv = await blank(ada, "cv", "Marketing CV")
    expect((await ada.run("paper.delete", { docId: cv.id })).status).toBe(200)
    expect(failureOf(await opened(ada, cv.id)).code).toBe("NOT_FOUND")
  })

  it.fails("is on the person's list of Papers (#1815)", async () => {
    const ada = await world.person("Ada")
    const cv = await blank(ada, "cv", "Marketing CV")
    const listed = dataOf<Paper[]>(await ada.get("/api/paper", asEditor))
    expect(listed.map((paper) => paper.id)).toContain(cv.id)
  })

  it.fails("can be renamed (#1815)", async () => {
    const ada = await world.person("Ada")
    const cv = await blank(ada, "cv", "Marketing CV")
    const renamed = await ada.run("paper.rename", {
      docId: cv.id,
      name: "Product CV",
      writer,
    })
    expect(renamed.status).toBe(200)
  })

  it.fails("can be copied (#1815)", async () => {
    const ada = await world.person("Ada")
    const cv = await blank(ada, "cv", "Marketing CV")
    const copy = await ada.run("paper.duplicate", { docId: cv.id, writer })
    expect(copy.status).toBe(200)
  })

  it.fails("can be marked ready (#1815)", async () => {
    const ada = await world.person("Ada")
    const cv = await blank(ada, "cv", "Marketing CV")
    const ready = await ada.run("paper.setStatus", {
      docId: cv.id,
      status: "ready",
      writer,
    })
    expect(ready.status).toBe(200)
  })

  it.fails("can be restored after it is deleted (#1815)", async () => {
    const ada = await world.person("Ada")
    const cv = await blank(ada, "cv", "Marketing CV")
    await ada.run("paper.delete", { docId: cv.id })
    const restored = await ada.run("paper.restoreDeleted", { docId: cv.id })
    expect(restored.status).toBe(200)
  })
})
