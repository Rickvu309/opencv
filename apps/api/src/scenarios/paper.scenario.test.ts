import { RICH_NATIVE_WRITER } from "@workspace/domain/paper-doc"
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
  return person.read("paper.read", { view: "info", docId, writer })
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
          await ada.run("paper.update", {
            docId: cv.id,
            writer,
            patch: { isFavorite },
          })
        ).isFavorite
      ).toBe(isFavorite)
  })

  it("is not found once it is deleted", async () => {
    const ada = await world.person("Ada")
    const cv = await blank(ada, "cv", "Marketing CV")
    expect((await ada.run("paper.delete", { docId: cv.id })).status).toBe(200)
    expect(failureOf(await opened(ada, cv.id)).code).toBe("NOT_FOUND")
  })

  it("is on the person's list of Papers", async () => {
    const ada = await world.person("Ada")
    const cv = await blank(ada, "cv", "Marketing CV")
    const listed = dataOf<Paper[]>(await ada.read("paper.list", { writer }))
    expect(listed.map((paper) => paper.id)).toContain(cv.id)
  })

  it("can be renamed", async () => {
    const ada = await world.person("Ada")
    const cv = await blank(ada, "cv", "Marketing CV")
    const renamed = await ada.run("paper.update", {
      docId: cv.id,

      writer,
      patch: { name: "Product CV" },
    })
    expect(renamed.status).toBe(200)
    expect(dataOf<Paper>(await opened(ada, cv.id)).name).toBe("Product CV")
    const listed = dataOf<Paper[]>(await ada.read("paper.list", { writer }))
    expect(listed.map((paper) => paper.name)).toEqual(["Product CV"])
  })

  it("is left off the list for an editor that cannot open it", async () => {
    const ada = await world.person("Ada")
    await blank(ada, "cv", "Marketing CV")
    await ada.run("paper.create", { kind: "letter", name: "Plain letter" })
    expect(dataOf<Paper[]>(await ada.read("paper.list", {}))).toEqual([])
  })

  it("can be copied, and the copy is a Paper of its own", async () => {
    const ada = await world.person("Ada")
    const cv = await blank(ada, "cv", "Marketing CV")
    const copy = await ada.run("paper.duplicate", { docId: cv.id, writer })
    expect(copy.status).toBe(200)
    const copied = dataOf<Paper>(copy)
    expect(copied.id).not.toBe(cv.id)
    expect(copied).toMatchObject({ name: "Copy of Marketing CV", kind: "cv" })
    await ada.run("paper.delete", { docId: cv.id })
    expect(dataOf<Paper>(await opened(ada, copied.id)).name).toBe(
      "Copy of Marketing CV"
    )
  })

  it("can be marked ready", async () => {
    const ada = await world.person("Ada")
    const cv = await blank(ada, "cv", "Marketing CV")
    const ready = await ada.run("paper.update", {
      docId: cv.id,

      writer,
      patch: { status: "ready" },
    })
    expect(ready.status).toBe(200)
    expect(dataOf<{ status: string }>(ready).status).toBe("ready")
  })

  it.fails("can be restored after it is deleted (#1836)", async () => {
    const ada = await world.person("Ada")
    const cv = await blank(ada, "cv", "Marketing CV")
    await ada.run("paper.delete", { docId: cv.id })
    const restored = await ada.run("paper.recover", { docId: cv.id })
    expect(restored.status).toBe(200)
  })
})

describe("a Paper in the list", () => {
  it("shows its first lines, and a blank one shows none", async () => {
    const ada = await world.person("Ada")
    await ada.run("paper.create", {
      kind: "letter",
      name: "Letter to Northwind",
      format: "rich",
      lines: ["Dear Northwind team,", "", "I would like to join you."],
    })
    await blank(ada, "cv", "Marketing CV")
    const listed = dataOf<(Paper & { preview?: string[] })[]>(
      await ada.read("paper.list", { writer })
    )
    expect(
      Object.fromEntries(listed.map((paper) => [paper.name, paper.preview]))
    ).toEqual({
      "Letter to Northwind": [
        "Dear Northwind team,",
        "I would like to join you.",
      ],
      "Marketing CV": [],
    })
  })
})
