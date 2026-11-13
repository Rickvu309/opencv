import { vi } from "vitest"

import {
  draftFromPage,
  loadDraft,
  storeDraft,
  type TextPoint,
} from "@/features/paper-page/canvas-edit.ts"
import {
  closeWritingDb,
  pageWords,
  settlePage,
} from "@/features/paper-page/canvas-save.ts"
import type { SaveOutcome } from "@/features/paper-page/canvas-save-outcome.ts"
import {
  openSheet,
  reduce,
  type CanvasAction,
  type CanvasState,
} from "@/features/paper-page/canvas-state.ts"
import {
  markedLines,
  unsavedBar,
} from "@/features/paper-page/canvas-unsaved.ts"
import {
  Failure,
  World,
  count,
  docId,
  fail,
  net,
  nextDoc,
  tinyIndexedDb,
  type Line,
  type Step,
} from "@/test/paper-page-walk-world.ts"

function flush() {
  return new Promise<void>((resolve) => setImmediate(resolve))
}

function sameDeps(left: unknown[] | null, right: unknown[]) {
  return !!left && left.every((value, index) => Object.is(value, right[index]))
}

class Page {
  state: CanvasState
  composing: { line: string } | null = null
  held: CanvasAction[] = []
  controller: AbortController | null = null
  savedFor: unknown[] | null = null
  storedFor: unknown[] | null = null
  conflicted = false
  alive = true
  reloaded = false

  constructor(world: World) {
    const page = world.page()
    this.state = openSheet(docId(), draftFromPage(page), page.revision)
    this.effects()
  }

  dispatch(action: CanvasAction) {
    this.state = reduce(this.state, action)
    this.effects()
  }

  deliver(action: CanvasAction) {
    if (!this.alive) return
    if (this.composing) this.held.push(action)
    else this.dispatch(action)
  }

  effects() {
    const state = this.state
    const stored = [state.present, state.basis, state.saved, state.unsaved]
    if (!sameDeps(this.storedFor, stored)) {
      this.storedFor = stored
      storeDraft(docId(), state.present, localStorage, state.basis, {
        saved: state.saved,
        unsaved: state.unsaved,
      })
    }
    const deps = [state.present, state.basis, state.typed, this.conflicted]
    if (sameDeps(this.savedFor, deps)) return
    this.savedFor = deps
    this.controller?.abort()
    const words = pageWords(state.present.blocks)
    const typed = state.typed
    if (words === "" || typed)
      this.state = reduce(this.state, {
        type: "note",
        note: "Writing is not saved yet. A copy stays on this computer.",
      })
    const controller = new AbortController()
    this.controller = controller
    void settlePage(docId(), state.present.blocks, controller.signal, {
      basis: state.basis,
      typed,
      caret: state.present.caret,
      refused: state.unsaved,
    }).then((outcome: SaveOutcome) => {
      if (controller.signal.aborted || !this.alive) return
      if (outcome.moved) this.conflicted = true
      else if (outcome.saved || outcome.replace) this.conflicted = false
      this.deliver({ type: "settled", outcome, words, typed })
    })
  }

  point(line: number, at: number): TextPoint | null {
    const blocks = this.state.present.blocks
    const block = blocks[line % blocks.length]
    if (!block) return null
    return { blockId: block.id, offset: Math.min(at, block.text.length) }
  }

  person(step: Step) {
    const at = (point: TextPoint) => ({ anchor: point, focus: point })
    if (step.kind === "type") {
      const point = this.point(step.line, step.at)
      if (point)
        this.dispatch({ type: "insert", span: at(point), text: step.text })
    } else if (step.kind === "enter") {
      const point = this.point(step.line, step.at)
      if (point) this.dispatch({ type: "split", span: at(point) })
    } else if (step.kind === "join") {
      const point = this.point(step.line, 0)
      if (point)
        this.dispatch({
          type: "delete",
          span: at(point),
          direction: "backward",
          reach: "character",
        })
    } else if (step.kind === "deleteLine") {
      const blocks = this.state.present.blocks
      const index = step.line % blocks.length
      const from = blocks[index]
      const to = blocks[index + 1]
      if (from && to)
        this.dispatch({
          type: "delete",
          span: {
            anchor: { blockId: from.id, offset: 0 },
            focus: { blockId: to.id, offset: 0 },
          },
          direction: "backward",
          reach: "selection",
        })
    } else if (step.kind === "paste") {
      const point = this.point(step.line, 999)
      if (point)
        this.dispatch({ type: "paste", span: at(point), text: step.text })
    } else if (step.kind === "undo" || step.kind === "redo") {
      this.dispatch({ type: step.kind })
    } else if (step.kind === "useSaved") {
      if (this.state.moved) {
        count("use saved page")
        this.conflicted = false
        this.dispatch({ type: "useSaved" })
      }
    } else if (step.kind === "restore") {
      const lines = unsavedBar(this.state).lines
      const line = lines[step.pick % Math.max(lines.length, 1)]
      if (line) count("restore line")
      if (line) this.dispatch({ type: "restoreLine", id: line.id })
    }
  }

  composeStart(line: number) {
    const point = this.point(line, 999)
    if (point) this.composing = { line: point.blockId }
  }

  composeEnd(text: string) {
    const composing = this.composing
    if (!composing) return
    this.composing = null
    const flush = () => {
      const held = this.held
      this.held = []
      for (const action of held) this.dispatch(action)
    }
    const present = this.state.present
    if (!present.blocks.some((block) => block.id === composing.line))
      return flush()
    const texts = present.blocks.map((block) => ({
      id: block.id,
      text: block.id === composing.line ? block.text + text : block.text,
    }))
    const block = texts.find((item) => item.id === composing.line)
    this.dispatch({
      type: "composed",
      texts,
      caret: { blockId: composing.line, offset: block?.text.length ?? 0 },
      from: null,
      split: false,
      nextId: present.nextId,
    })
    flush()
  }

  close() {
    this.alive = false
    this.controller?.abort()
  }
}

function linesAt(world: World, revision: string | undefined) {
  return revision ? world.history.get(revision) : undefined
}

function serverHandles(state: CanvasState, saved: Line[]) {
  const pageSaved = state.saved?.blocks ?? []
  const pairs =
    pageSaved.length === saved.length
      ? pageSaved.map((block, index): [string, string] => [
          block.id,
          saved[index]?.handle ?? block.id,
        ])
      : []
  const handles = new Map(pairs)
  return (id: string) => handles.get(id) ?? id
}

function oracleDiscards(state: CanvasState, saved: Line[]) {
  const moved = state.moved
  if (!moved) return 0
  const handleOf = serverHandles(state, saved)
  const before = new Map(saved.map((line) => [line.handle, line.text]))
  const theirs = new Map(moved.head.map((block) => [block.id, block.text]))
  const own = new Set(state.present.blocks.map((block) => handleOf(block.id)))
  const lines = state.present.blocks.filter((block) => {
    const handle = handleOf(block.id)
    return (
      before.get(handle) !== block.text && theirs.get(handle) !== block.text
    )
  }).length
  const removed = saved.filter(
    (line) => !own.has(line.handle) && theirs.has(line.handle)
  ).length
  return lines + removed
}

function check(world: World, page: Page, label: string) {
  if (world.violation) fail(`${world.violation} (${label})`)
  const state = page.state
  const words = pageWords(state.present.blocks)
  const basisLines = linesAt(world, state.basis?.revision)
  if (state.basis) {
    if (!basisLines)
      fail(`the page is based on a revision the server never had (${label})`)
    if (basisLines.map((line) => line.text).join("\n") !== state.basis.words)
      fail(
        `I4 honest marks: the page's basis words differ from the server at that revision (${label})`
      )
    if (state.saved && pageWords(state.saved.blocks) !== state.basis.words)
      fail(
        `I4 honest marks: the saved lines differ from the page they are based on (${label})`
      )
  }
  if (
    state.note === "Saved" &&
    (!basisLines || basisLines.map((line) => line.text).join("\n") !== words)
  )
    fail(
      `I4 honest marks: the page reads Saved but the server does not hold its words (${label})`
    )
  const server = new Map(
    (basisLines ?? []).map((line) => [line.handle, line.text])
  )
  for (const line of state.unsaved) {
    if (line.removed) continue
    const shown = state.present.blocks.find((block) => block.id === line.id)
    if (shown && shown.text === line.text && server.get(line.id) === line.text)
      fail(
        `I4 honest marks: "${line.text}" is marked not saved but the server holds it (${label})`
      )
  }
  const marked = new Set(markedLines(state))
  for (const id of marked)
    if (!state.present.blocks.some((block) => block.id === id))
      fail(
        `I4 honest marks: a mark points at a line that is not on the page (${label})`
      )
  if (state.moved) count("moved")
  if (state.pageRefusal) count("page refused")
  if (state.unsaved.length > 1) count("several lines marked")
  if (state.unsaved.some((line) => line.removed)) count("removal marked")
  if (state.note === "Saved") count("saved")
  const ownSaveSeenAsElsewhere =
    !!state.moved &&
    !!state.basis &&
    world.onlyPageWroteSince(state.basis.revision, state.moved.basis.revision)
  if (ownSaveSeenAsElsewhere) count("own save seen as changed elsewhere")
  if (ownSaveSeenAsElsewhere && !page.reloaded)
    count("own save seen as changed elsewhere without a reload")
  if (state.moved) {
    const head = linesAt(world, state.moved.basis.revision)
    if (
      !head ||
      head.map((line) => line.text).join("\n") !== state.moved.basis.words
    )
      fail(`the changed-elsewhere page is not a page the server had (${label})`)
    const stated = unsavedBar(state).discards
    const truth = oracleDiscards(state, basisLines ?? [])
    if (stated !== truth && ownSaveSeenAsElsewhere)
      fail(
        `I4 honest marks: Use the saved page says it discards ${stated} lines but it discards ${truth}, after the page's own save was seen as a change elsewhere (${label})`
      )
    if (stated !== truth)
      fail(
        `I4 honest marks: Use the saved page says it discards ${stated} lines but it discards ${truth} (${label})`
      )
  }
  const kept = loadDraft(docId(), localStorage)
  if (!kept || pageWords(kept.blocks) !== words)
    fail(`I3 words kept: the local copy differs from the page (${label})`)
  for (const block of state.present.blocks) {
    const line = world.lines.find((item) => item.handle === block.id)
    if (line && line.text === block.text) world.base.set(block.id, line.version)
  }
}

async function drain(world: World, page: Page, label: string) {
  const before = world.requests
  const server = new Map(world.lines.map((line) => [line.handle, line.text]))
  const changed = page.state.present.blocks.filter(
    (block) => server.get(block.id) !== block.text
  ).length
  const cap = 6 * (changed + 1) + 12 + 4 * page.state.unsaved.length
  for (let round = 0; ; round += 1) {
    await flush()
    if (world.violation) fail(`${world.violation} (${label})`)
    if (world.requests - before > cap)
      fail(
        `I1 quiet when idle: ${world.requests - before} requests with no input for ${changed} changed lines (${label})`
      )
    if (world.pending.length > 0) {
      world.answer(0, "none")
      continue
    }
    if (vi.getTimerCount() > 0) {
      vi.advanceTimersToNextTimer()
      continue
    }
    if (round > 4000)
      fail(`I1 quiet when idle: the page never settles (${label})`)
    return
  }
}

async function reloadPage(world: World, page: Page) {
  page.close()
  while (world.pending.length > 0) {
    world.answer(0, "lost")
    await flush()
  }
  vi.clearAllTimers()
  await flush()
  await closeWritingDb()
  const next = new Page(world)
  next.reloaded = true
  return next
}

export async function walk(steps: readonly Step[]): Promise<string | null> {
  nextDoc()
  const world = new World()
  vi.stubGlobal("indexedDB", tinyIndexedDb())
  net.read = (_docId, signal) => world.read(signal)
  net.send = (input) => world.send(input)
  localStorage.clear()
  vi.spyOn(navigator, "onLine", "get").mockImplementation(() => world.online)
  let page = new Page(world)
  let index = -1
  try {
    await flush()
    check(world, page, "open")
    for (const [at, step] of steps.entries()) {
      index = at
      const label = `step ${at} ${step.kind}`
      const words = pageWords(page.state.present.blocks)
      const clean =
        linesAt(world, page.state.basis?.revision)
          ?.map((line) => line.text)
          .join("\n") === words
      let person = false
      if (step.kind === "composeStart") {
        if (!page.composing) page.composeStart(step.line)
      } else if (step.kind === "composeEnd") {
        person = !!page.composing
        page.composeEnd(step.text)
      } else if (step.kind === "answer") {
        if (world.pending.length > 0) world.answer(step.pick, step.fault)
      } else if (step.kind === "drain") {
        await drain(world, page, label)
      } else if (step.kind === "time") {
        vi.advanceTimersByTime(step.ms)
      } else if (step.kind === "elsewhere") {
        world.elsewhere(step.line, step.change)
      } else if (step.kind === "mode") {
        world.mode = step.mode
      } else if (step.kind === "network") {
        world.online = step.online
        if (step.online) window.dispatchEvent(new Event("online"))
      } else if (step.kind === "reload") {
        page = await reloadPage(world, page)
        if (pageWords(page.state.present.blocks) !== words)
          fail(
            `I3 words kept: a reload changed the words on the page (${label})`
          )
      } else if (!page.composing) {
        person = true
        page.person(step)
      }
      await flush()
      if (!person) {
        const now = pageWords(page.state.present.blocks)
        if (now !== words && !clean)
          fail(
            `I3 words kept: the page changed the person's unsaved words without their action (${label})`
          )
      }
      check(world, page, label)
    }
    page.composeEnd("")
    await flush()
    await drain(world, page, "end")
    check(world, page, "end")
    return null
  } catch (error) {
    if (error instanceof Failure) return `${error.message} at ${index}`
    throw error
  } finally {
    page.close()
    for (let round = 0; round < 200 && world.pending.length > 0; round += 1) {
      world.answer(0, "lost")
      await flush()
    }
    if (world.pending.length > 0) count("left asking after close")
    vi.clearAllTimers()
    await closeWritingDb()
    vi.restoreAllMocks()
  }
}

export function invariant(failure: string | null) {
  return failure?.split(":")[0] ?? null
}

export async function shortest(
  steps: readonly Step[],
  failure: string
): Promise<Step[]> {
  let current = steps.slice()
  let size = Math.max(1, Math.floor(current.length / 2))
  while (size >= 1) {
    let removed = false
    for (let start = 0; start < current.length; start += size) {
      const candidate = current
        .slice(0, start)
        .concat(current.slice(start + size))
      if (invariant(await walk(candidate)) === invariant(failure)) {
        current = candidate
        removed = true
        start -= size
      }
    }
    if (!removed) size = Math.floor(size / 2)
  }
  return current
}
