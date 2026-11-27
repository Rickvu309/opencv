import { and, eq } from "drizzle-orm"
import { layoutPageSchema, type LayoutPage } from "@workspace/domain/paper-doc"
import {
  createLayouter,
  paperFontMetrics,
  type Layouter,
} from "@workspace/paper-engine"

import { getDb, outsideTransaction } from "../../db/context.js"
import { paperDocs } from "../../db/schema.js"
import { NEW_ENGINE, type PaperLog } from "./paper-log.js"

export const FIRST_PAGE_DELAY_MS = 400

export type FirstPageSave = (docId: string, page: LayoutPage) => Promise<void>

export async function writeFirstPage(docId: string, page: LayoutPage) {
  await getDb()
    .update(paperDocs)
    .set({ firstPage: layoutPageSchema.parse(page) })
    .where(and(eq(paperDocs.id, docId), eq(paperDocs.engine, NEW_ENGINE)))
}

export type FirstPageDebounce = (
  docId: string,
  paint: (docId: string) => Promise<void>
) => void

export function timeoutDebounce(delayMs: number): FirstPageDebounce {
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  return (docId, paint) => {
    const pending = timers.get(docId)
    if (pending) clearTimeout(pending)
    const timer = setTimeout(() => {
      timers.delete(docId)
      outsideTransaction(() => paint(docId)).catch((error: unknown) => {
        console.error("The Paper first page was not stored", { docId, error })
      })
    }, delayMs)
    timers.set(docId, timer)
  }
}

export type FirstPageLog = PaperLog & {
  flushFirstPage(docId: string): Promise<void>
}

export function keepFirstPage(
  log: PaperLog,
  {
    debounce = timeoutDebounce(FIRST_PAGE_DELAY_MS),
    layouter = createLayouter(paperFontMetrics),
    save = writeFirstPage,
  }: {
    debounce?: FirstPageDebounce
    layouter?: Layouter
    save?: FirstPageSave
  } = {}
): FirstPageLog {
  async function paint(docId: string) {
    const head = await log.head(docId)
    if ("refusal" in head || "missing" in head) return
    const first = layouter.layout(head.doc, null).pages[0]!
    await save(docId, layoutPageSchema.parse(first))
  }

  function touched(docId: string) {
    debounce(docId, paint)
  }

  return {
    ...log,
    async start(docId, doc) {
      const result = await log.start(docId, doc)
      if ("ok" in result) touched(docId)
      return result
    },
    async append(docId, input, activity) {
      const result = await log.append(docId, input, activity)
      if ("ok" in result) touched(docId)
      return result
    },
    async revert(docId, edit, as) {
      const result = await log.revert(docId, edit, as)
      if ("ok" in result) touched(docId)
      return result
    },
    async flushFirstPage(docId) {
      await paint(docId)
    },
  }
}
