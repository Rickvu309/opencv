import { BlockNoteEditor } from "@blocknote/core"
import { paperSchema } from "@workspace/paper-crdt"
import { expect, it } from "vitest"

import { cvSchema } from "./cv-blocks.tsx"

function freeze(value: unknown): unknown {
  if (typeof value === "function") return "fn"
  if (Array.isArray(value)) return value.map(freeze)
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, freeze(item)])
    )
  }
  return value ?? null
}

function shape(schema: {
  nodes: Record<
    string,
    {
      spec: {
        content?: string
        marks?: string
        attrs?: Record<string, { default?: unknown }>
      }
    }
  >
}) {
  return Object.fromEntries(
    Object.keys(schema.nodes)
      .sort()
      .map((name) => {
        const spec = schema.nodes[name]!.spec
        const attrs = Object.fromEntries(
          Object.entries(spec.attrs ?? {})
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, value]) => [key, freeze(value.default)])
        )
        return [
          name,
          {
            content: typeof spec.content === "string" ? spec.content : "",
            marks: spec.marks ?? "",
            attrs,
          },
        ]
      })
  )
}

it("matches the server ProseMirror schema for every CV block", () => {
  const server = BlockNoteEditor.create({ schema: paperSchema })
  const web = BlockNoteEditor.create({ schema: cvSchema })
  expect(shape(web.pmSchema)).toEqual(shape(server.pmSchema))
  server._tiptapEditor.destroy()
  web._tiptapEditor.destroy()
})
