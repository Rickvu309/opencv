import type { Block, Document } from "@workspace/domain/paper-doc"

import { contentRect, shapeBlock, type BlockShape } from "./block-shape.js"
import { fillPage, type Cursor } from "./paginate.js"
import { pageSize } from "./styles.js"
import type { Layout, LayoutWork, Metrics, Page } from "./types.js"

type LayoutState = {
  key: string
  blocks: readonly Block[]
  starts: readonly Cursor[]
  work: LayoutWork
  startIndex?: Map<string, number>
}

const states = new WeakMap<Layout, LayoutState>()

const cursorKey = (cursor: Cursor) =>
  `${cursor.block}:${cursor.part}:${cursor.counters}`

export function layoutWork(layout: Layout): LayoutWork {
  return states.get(layout)?.work ?? { blocksLaidOut: 0, pagesPaginated: 0 }
}

function firstPageOf(starts: readonly Cursor[], block: number): number {
  let low = 0
  let high = starts.length - 1
  while (low < high) {
    const mid = Math.ceil((low + high) / 2)
    if (
      starts[mid]!.block <= block &&
      !(starts[mid]!.block === block && starts[mid]!.part > 0)
    ) {
      low = mid
    } else {
      high = mid - 1
    }
  }
  return low
}

function blockPagesOf(pages: readonly Page[]): Record<string, number[]> {
  const found: Record<string, number[]> = {}
  for (const page of pages) {
    for (const box of page.boxes) {
      const list = (found[box.block] ??= [])
      if (list.at(-1) !== page.index) list.push(page.index)
    }
  }
  return found
}

export type Layouter = {
  layout(doc: Document, previous: Layout | null): Layout
}

export function createLayouter(metrics: Metrics): Layouter {
  const caches = new Map<string, WeakMap<Block, BlockShape>>()

  return {
    layout(doc, previous) {
      const size = pageSize(doc.attrs.page)
      const content = contentRect(doc.attrs.page, size)
      const key = JSON.stringify([doc.attrs.template, doc.attrs.page])
      let cache = caches.get(key)
      if (!cache) {
        cache = new WeakMap()
        caches.set(key, cache)
      }
      const shapeCache = cache
      const blocks = doc.content
      const count = blocks.length
      const work: LayoutWork = { blocksLaidOut: 0, pagesPaginated: 0 }
      const shapes: (BlockShape | undefined)[] = new Array(count)
      const ctx = { template: doc.attrs.template, content, metrics }
      const shapeAt = (index: number): BlockShape => {
        let shape = shapes[index]
        if (shape) return shape
        const block = blocks[index]!
        shape = shapeCache.get(block)
        if (!shape) {
          work.blocksLaidOut += 1
          shape = shapeBlock(block, ctx)
          shapeCache.set(block, shape)
        }
        shapes[index] = shape
        return shape
      }

      let pages: Page[] = []
      let starts: Cursor[] = []
      let cursor: Cursor | null = { block: 0, part: 0, counters: "" }
      const prev = previous ? states.get(previous) : undefined
      let rejoin: ((at: Cursor) => number) | null = null

      if (previous && prev && prev.key === key) {
        const old = prev.blocks
        let same = 0
        while (same < count && same < old.length && blocks[same] === old[same])
          same += 1
        if (same === count && same === old.length) {
          const unchanged: Layout = { ...previous, page: doc.attrs.page }
          states.set(unchanged, { ...prev, work })
          return unchanged
        }
        let suffix = 0
        while (
          suffix < count - same &&
          suffix < old.length - same &&
          blocks[count - 1 - suffix] === old[old.length - 1 - suffix]
        ) {
          suffix += 1
        }
        let chain = Math.min(same, old.length - 1)
        while (chain > 0) {
          const shape = shapeAt(chain - 1)
          if (shape.kind !== "text" || !shape.keepWithNext) break
          chain -= 1
        }
        const startPage = firstPageOf(prev.starts, chain)
        pages = previous.pages.slice(0, startPage)
        starts = prev.starts.slice(0, startPage)
        cursor = prev.starts[startPage]!
        const delta = count - old.length
        const sharedFrom = count - suffix
        const index =
          prev.startIndex ??
          (prev.startIndex = new Map(
            prev.starts.map((start, page) => [cursorKey(start), page])
          ))
        rejoin = (at) => {
          if (at.block < sharedFrom || at.block >= count) return -1
          return index.get(cursorKey({ ...at, block: at.block - delta })) ?? -1
        }
      }

      let first = true
      while (cursor) {
        if (rejoin && !first) {
          const page = rejoin(cursor)
          if (page >= 0) {
            const delta = count - prev!.blocks.length
            for (let q = page; q < previous!.pages.length; q += 1) {
              const reused = previous!.pages[q]!
              const start = prev!.starts[q]!
              pages.push(
                reused.index === pages.length
                  ? reused
                  : { ...reused, index: pages.length }
              )
              starts.push(
                delta === 0 ? start : { ...start, block: start.block + delta }
              )
            }
            break
          }
        }
        first = false
        const { boxes, next } = fillPage(count, shapeAt, cursor, content)
        work.pagesPaginated += 1
        pages.push({ index: pages.length, size, content, boxes })
        starts.push(cursor)
        cursor = next
      }

      const layout: Layout = {
        page: doc.attrs.page,
        pages,
        blockPages: blockPagesOf(pages),
      }
      states.set(layout, { key, blocks, starts, work })
      return layout
    },
  }
}
