import {
  createEngine,
  createLayouter,
  fixedClock,
  layoutWork,
  paperFontMetrics,
  seededIds,
} from "../src/index.js"
import type { BlockId } from "@workspace/domain/paper-doc"
import { readCorpusCv } from "./corpus-cv.js"

const [id = "en-10", keys = "400"] = process.argv.slice(2)
const P95_FAIL_MS = 8
const P95_TARGET_MS = 4
const engine = createEngine({ ids: seededIds("bench"), now: fixedClock() })
const layouter = createLayouter(paperFontMetrics)
let state = engine.load(readCorpusCv(id), 0, "bench")
let layout = layouter.layout(engine.read(state).doc, null)
const target = engine
  .read(state)
  .doc.content.find(
    (block) =>
      block.type === "text_block" &&
      block.attrs.kind === "paragraph" &&
      layout.blockPages[block.attrs.id]?.[0] === 1
  )!.attrs.id as BlockId
const text = "and kept a review log for every disputed label "
const samples: number[] = []
const rebroken: number[] = []
for (let n = 0; n < Number(keys); n += 1) {
  const block = engine
    .read(state)
    .doc.content.find((each) => each.attrs.id === target)!
  const offset =
    block.type === "text_block"
      ? (block.content ?? []).reduce(
          (sum, run) => sum + (run.type === "text" ? run.text.length : 1),
          0
        )
      : 0
  const started = performance.now()
  const ran = engine.run(
    state,
    [
      {
        op: "insertText",
        range: {
          from: { block: target, offset },
          to: { block: target, offset },
        },
        text: text[n % text.length]!,
      },
    ],
    { kind: "person", actor: "bench", client: "bench" }
  )
  if ("refusal" in ran) throw new Error(JSON.stringify(ran.refusal))
  state = ran.state
  layout = layouter.layout(engine.read(state).doc, layout)
  samples.push(performance.now() - started)
  rebroken.push(layoutWork(layout).blocksLaidOut)
}
const sorted = [...samples].sort((a, b) => a - b)
const at = (q: number) =>
  sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!
const p95 = at(0.95)
console.log(
  JSON.stringify({
    id,
    keys: samples.length,
    pages: layout.pages.length,
    p50Ms: Number(at(0.5).toFixed(3)),
    p95Ms: Number(p95.toFixed(3)),
    maxMs: Number(sorted.at(-1)!.toFixed(3)),
    maxBlocksRebroken: Math.max(...rebroken),
    targetMs: P95_TARGET_MS,
    failMs: P95_FAIL_MS,
  })
)
if (p95 > P95_FAIL_MS) process.exitCode = 1
