import { QueryClient } from "@tanstack/react-query"
import { paperDocumentSchema } from "@workspace/domain"
import { seedYDoc, writeAsEditor } from "@workspace/paper-crdt"
import { openPaperSync, toBase64 } from "/src/lib/paper-sync.ts"
import { stateVectorOf, loadYDoc } from "@workspace/paper-crdt"

const params = new URLSearchParams(location.search)
const docId = params.get("doc")
const tabId = params.get("tab") ?? "crash-tab"
const blocks = Number(params.get("blocks") ?? 2)
const ids = Array.from({ length: blocks }, (_, at) =>
  at === 0 ? "a" : at === 1 ? "b" : `p-${at}`
)
const seedKey = "paper-crash-seed"
let seed = localStorage.getItem(seedKey)
if (!seed) {
  seed = toBase64(
    seedYDoc(
      paperDocumentSchema.parse({
        version: 3,
        kind: "letter",
        blocks: ids.map((id) => ({
          id,
          type: "paragraph",
          content: [
            { text: blocks > 2 ? `Old ${id}. `.repeat(100) : `Old ${id}.` },
          ],
        })),
        clashes: [],
      })
    )
  )
  localStorage.setItem(seedKey, seed)
}
const bytes = Uint8Array.from(atob(seed), (char) => char.charCodeAt(0))
const vector = toBase64(stateVectorOf(loadYDoc(bytes, [])))
let calls = 0
const sync = openPaperSync(docId, new QueryClient(), {
  tabId,
  run: async () => {
    if (calls++ > 0) throw new Error("fake server is offline")
    return {
      docId,
      epoch: 1,
      revision: 1,
      reset: false,
      stale: false,
      update: seed,
      stateVector: vector,
    }
  },
})
const inputs = new Map()
for (const id of ids) {
  const input = document.createElement("input")
  input.id = id
  input.setAttribute("aria-label", `Paper paragraph ${id}`)
  input.addEventListener("input", () => {
    const started = performance.now()
    const client = sync.client()
    const current = client.document()
    const next = paperDocumentSchema.parse({
      ...current,
      blocks: current.blocks.map((block) =>
        block.id === id ? { ...block, content: [{ text: input.value }] } : block
      ),
    })
    writeAsEditor(client.ydoc, next, "person")
    window.crashSignal?.(
      JSON.stringify({
        kind: "input",
        durationMs: performance.now() - started,
        finishedAt: performance.timeOrigin + performance.now(),
      })
    )
  })
  inputs.set(id, input)
  document.body.append(input)
}
let announced = false
sync.subscribe(() => {
  const doc = sync.client()?.document()
  if (!doc || !sync.ready()) return
  for (const block of doc.blocks) {
    const input = inputs.get(block.id)
    if (input && "content" in block)
      input.value = block.content
        .map((part) => ("text" in part ? part.text : ""))
        .join("")
  }
  if (!announced && sync.status() !== "loading") {
    announced = true
    window.crashSignal?.(JSON.stringify({ kind: "ready" }))
  }
})
