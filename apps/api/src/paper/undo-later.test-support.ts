import { catalog } from "@workspace/domain/kernel"
import { RICH_NATIVE_WRITER } from "@workspace/domain/paper-doc"

import { idOf, text } from "../registry/coverage-helpers.test-support.js"
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
  [catalog["paper.create"].name]: renamedTo("Renamed"),
  [catalog["paper.duplicate"].name]: renamedTo("Renamed"),
  [catalog["paper.update"].name]: renamedTo("Renamed later"),
}
