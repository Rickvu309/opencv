import {
  paperDocumentSchema,
  plainTextOfRuns,
  type ListItem,
  type PaperDocument,
} from "@workspace/domain"
import * as Y from "yjs"
import { describe, expect, it } from "vitest"

import {
  materialize,
  revertOrigin,
  seedYDoc,
  writeDocument,
  type HistoryRow,
} from "./index.js"

const ORIGINAL = "Wrote the first program for the engine"
const COACH = "coach:edit-1"

type Shape = { bullet: string; extra?: string; entry?: boolean }

function cv({ bullet, extra, entry = true }: Shape): PaperDocument {
  const children = [
    { id: "x1a", type: "bullet", content: bullet, children: [] },
    ...(extra
      ? [{ id: "x1b", type: "bullet", content: extra, children: [] }]
      : []),
  ]
  return paperDocumentSchema.parse({
    version: 3,
    kind: "cv",
    header: {
      id: "header",
      type: "header",
      name: "Ada",
      email: "",
      phone: "",
      city: "",
      linkedin: "",
    },
    blocks: [
      { id: "s1", type: "section", kind: "experience", title: "Experience" },
      ...(entry
        ? [
            {
              id: "x1",
              type: "experience",
              role: "Analyst",
              company: "Babbage",
              period: "1842",
              location: "",
              children,
            },
          ]
        : []),
      { id: "p9", type: "paragraph", content: "Closing line" },
    ],
    clashes: [],
  })
}

function itemsOf(document: PaperDocument): ListItem[] {
  const entry = document.blocks.find((block) => block.type === "experience")
  return entry?.type === "experience" ? entry.children : []
}

function texts(document: PaperDocument): string[] {
  return itemsOf(document).map((item) => plainTextOfRuns(item.content))
}

function snapshot(yDoc: Y.Doc): PaperDocument {
  const result = materialize(yDoc)
  if (!result.ok) throw new Error(result.reason)
  expect(paperDocumentSchema.safeParse(result.document).success).toBe(true)
  return result.document
}

function room(base: PaperDocument) {
  const seed = seedYDoc(base)
  const live = new Y.Doc()
  Y.applyUpdate(live, seed, "seed")
  const history: HistoryRow[] = [{ update: seed, origin: "seed" }]
  const merge = (update: Uint8Array | null, origin: string) => {
    if (!update) throw new Error("expected an update")
    Y.applyUpdate(live, update, origin)
    history.push({ update, origin })
  }
  const fork = () => {
    const copy = new Y.Doc()
    Y.applyUpdate(copy, Y.encodeStateAsUpdate(live))
    return copy
  }
  return { live, history, merge, fork }
}

describe("a Yjs paper document with no DOM", () => {
  it("runs where no document or window exists", () => {
    expect("document" in globalThis).toBe(false)
    expect("window" in globalThis).toBe(false)
  })

  it("seeds, materializes and writes only what differs", () => {
    const base = cv({ bullet: ORIGINAL })
    const yDoc = new Y.Doc()
    Y.applyUpdate(yDoc, seedYDoc(base))
    expect(snapshot(yDoc)).toEqual(base)
    expect(writeDocument(yDoc, base, "person")).toBeNull()
    const typed = writeDocument(yDoc, cv({ bullet: `${ORIGINAL}!` }), "person")
    expect(typed?.length).toBeLessThan(40)
  })

  it("keeps person and Coach characters and reverts only the Coach", () => {
    const base = cv({ bullet: ORIGINAL })
    const { live, history, merge, fork } = room(base)
    const atRead = fork()

    let typed = ORIGINAL
    for (const word of [" and", " mentored", " two analysts"]) {
      typed += word
      merge(writeDocument(live, cv({ bullet: typed }), "person"), "person")
      snapshot(live)
    }
    const personOnly = snapshot(live)
    expect(texts(personOnly)).toEqual([typed])

    const coachTarget = cv({
      bullet: "Published the first algorithm for the engine",
      extra: "Translated Menabrea's paper",
    })
    merge(writeDocument(atRead, coachTarget, COACH), COACH)

    const merged = snapshot(live)
    const [head, added] = texts(merged)
    expect(head).toBe(
      "Published the first algorithm for the engine and mentored two analysts"
    )
    expect(added).toBe("Translated Menabrea's paper")

    const revert = revertOrigin(history, COACH)
    if (!revert) throw new Error("expected a revert update")
    Y.applyUpdate(live, revert, "revert")
    expect(snapshot(live)).toEqual(personOnly)
    expect(texts(snapshot(live))).toEqual([typed])
  })

  it("keeps characters typed inside the span the Coach replaced", () => {
    const base = cv({ bullet: ORIGINAL })
    const { live, history, merge, fork } = room(base)
    const atRead = fork()

    const inside = "Wrote the first (draft) program for the engine"
    merge(writeDocument(live, cv({ bullet: inside }), "person"), "person")
    merge(
      writeDocument(
        atRead,
        cv({ bullet: "Published the first algorithm for the engine" }),
        COACH
      ),
      COACH
    )

    const merged = texts(snapshot(live))[0] ?? ""
    expect(merged).toBe("Published the first (draft) algorithm for the engine")

    const revert = revertOrigin(history, COACH)
    if (!revert) throw new Error("expected a revert update")
    Y.applyUpdate(live, revert, "revert")
    const reverted = texts(snapshot(live))[0] ?? ""
    expect(reverted).toContain("(draft) ")
    expect(reverted.replace("(draft) ", "")).toBe(ORIGINAL)
  })

  it("restores a block the Coach removed and keeps later typing", () => {
    const base = cv({ bullet: ORIGINAL, extra: "Second point" })
    const { live, history, merge, fork } = room(base)
    const atRead = fork()

    merge(writeDocument(atRead, cv({ bullet: ORIGINAL }), COACH), COACH)
    expect(texts(snapshot(live))).toEqual([ORIGINAL])

    const afterwards = cv({ bullet: `${ORIGINAL} today` })
    merge(writeDocument(live, afterwards, "person"), "person")

    const revert = revertOrigin(history, COACH)
    if (!revert) throw new Error("expected a revert update")
    Y.applyUpdate(live, revert, "revert")
    expect(texts(snapshot(live))).toEqual([`${ORIGINAL} today`, "Second point"])
  })

  it("reverts the person's origin and leaves the Coach text", () => {
    const base = cv({ bullet: ORIGINAL })
    const { live, history, merge, fork } = room(base)
    const atRead = fork()
    merge(
      writeDocument(live, cv({ bullet: `${ORIGINAL} today` }), "person"),
      "person"
    )
    merge(
      writeDocument(
        atRead,
        cv({ bullet: "Published the first algorithm for the engine" }),
        COACH
      ),
      COACH
    )
    const revert = revertOrigin(history, "person")
    if (!revert) throw new Error("expected a revert update")
    Y.applyUpdate(live, revert, "revert")
    expect(texts(snapshot(live))).toEqual([
      "Published the first algorithm for the engine",
    ])
  })

  it("reverts nothing when the origin never wrote", () => {
    const { history } = room(cv({ bullet: ORIGINAL }))
    expect(revertOrigin(history, "coach:never")).toBeNull()
  })
})
