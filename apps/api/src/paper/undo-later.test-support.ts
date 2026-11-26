import { RICH_NATIVE_WRITER } from "@workspace/domain/paper-doc"

import { idOf, list, text } from "../registry/coverage-helpers.test-support.js"
import type { ExecuteResult } from "../registry/registry.js"
import type {
  LaterCases,
  LaterWorld,
} from "../registry/undo-later.test-support.js"

async function paperName(world: LaterWorld, a: ExecuteResult) {
  const paper = await world.read("paper.read", {
    view: "info",
    docId: idOf(a.output),
    writer: RICH_NATIVE_WRITER,
  })
  return text(paper, "name")
}

function pageWords(page: unknown) {
  return list(page, "regions")
    .map((region) => {
      if (!region || typeof region !== "object") return ""
      const row = region as Record<string, unknown>
      return typeof row.text === "string" ? row.text : ""
    })
    .join("\n")
}

function writtenParagraph(page: unknown) {
  for (const region of list(page, "regions")) {
    if (!region || typeof region !== "object") continue
    const row = region as Record<string, unknown>
    if (
      row.kind === "editable" &&
      row.text === "Harbor light" &&
      typeof row.paragraph === "string"
    ) {
      return row.paragraph
    }
  }
  throw new Error("missing written paragraph")
}

function renamedTo(name: string) {
  return {
    act: async (a: ExecuteResult, { run }: LaterWorld) => {
      await run("paper.update", {
        docId: idOf(a.output),
        writer: RICH_NATIVE_WRITER,
        patch: { name },
      })
    },
    survives: async (a: ExecuteResult, world: LaterWorld) =>
      (await paperName(world, a).catch(() => "gone")) === name,
  }
}

export const paperUndoLater: LaterCases = {
  "paper.create": renamedTo("Renamed"),
  "paper.duplicate": renamedTo("Renamed"),
  "paper.update": renamedTo("Renamed later"),
  "paper.canvas": {
    act: async (a, { run, read }) => {
      const docId = text(a.output, "docId")
      const basedOn = text(a.output, "revision")
      if (!docId || !basedOn) throw new Error("missing page")
      const handle = writtenParagraph(await read("paper.read", { docId }))
      await run("paper.canvas", {
        op: "write",
        batch: {
          doc: docId,
          basedOn,
          ops: [
            { op: "setText", handle, text: "Harbor" },
            { op: "insert", after: handle, text: " light" },
          ],
        },
      })
    },
    survives: async (a, { read }) => {
      const docId = text(a.output, "docId")
      if (!docId) return false
      const page = await read("paper.read", { docId })
      const words = pageWords(page)
      return (
        words.includes("Harbor") &&
        words.includes("light") &&
        text(page, "revision") !== text(a.output, "revision")
      )
    },
  },
}
