import {
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { useQuery } from "@tanstack/react-query"
import type { LayoutPage } from "@workspace/domain/paper-doc"
import { flushSync } from "react-dom"
import { File } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { motionToken } from "@workspace/ui/lib/motion"
import { cn } from "@workspace/ui/lib/utils"

import { useOwnerId } from "@/lib/owner-id.ts"
import { paperFirstPagesQuery } from "@/lib/paper-first-pages.ts"

import { PaperSheet } from "./paper-library-card.tsx"
import { PaperHandCaption } from "./paper-hand-caption.tsx"
import { emptyHandCopy, PaperHandEmpty } from "./paper-hand-empty.tsx"
import {
  entryName,
  fileBadge,
  type LibraryEntry,
  type LibraryView,
} from "./paper-library-entries.ts"
import {
  LibraryDocumentSheet,
  libraryEntryActions,
  PaperProofsLink,
  type LibraryEntryHandlers,
} from "./paper-library-sections.tsx"
import {
  handCardWidth,
  handCards,
  handCentre,
  handClamp,
  handDrag,
  handList,
  handPose,
  handPreviewIds,
  HAND_NARROW_WIDTH,
  handRelease,
  handSpread,
  handStep,
  handTransform,
  handWheel,
  type HandPose,
} from "./paper-hand-layout.ts"
import { paperEditedLabel } from "./paper-templates.ts"
import { PaperStarts } from "./paper-hand-starts.tsx"
import { PaperStartHand } from "./paper-start-hand.tsx"
import "./design/paper-hand.css"

const DRAG_START_PX = 4

type Phase = "enter" | "settle" | "still"

type PaperHandState = {
  pos: number
  hovered: number
  dragging: boolean
  dropping: boolean
  wheeling: boolean
  phase: Phase
  viewport: number
  absorb: boolean
}

type PaperHandAction =
  | { type: "reset" }
  | { type: "hover"; index: number }
  | { type: "drag_on" }
  | { type: "drag_move"; pos: number }
  | { type: "drag_end"; pos: number }
  | { type: "wheel"; pos: number }
  | { type: "wheel_end"; pos: number }
  | { type: "jump"; pos: number }
  | { type: "drop"; dropping: boolean }
  | { type: "settle" }
  | { type: "still" }
  | { type: "absorbed" }
  | { type: "viewport"; viewport: number }

function readViewport() {
  if (typeof window === "undefined") return 1200
  return window.innerWidth
}

function prefersReduced() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function")
    return false
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function initialPaperHand(viewport: number, reduced: boolean): PaperHandState {
  return {
    pos: 0,
    hovered: -1,
    dragging: false,
    dropping: false,
    wheeling: false,
    phase: reduced ? "still" : "enter",
    viewport,
    absorb: false,
  }
}

function paperHandReducer(
  state: PaperHandState,
  action: PaperHandAction
): PaperHandState {
  switch (action.type) {
    case "reset":
      return {
        ...state,
        pos: 0,
        hovered: -1,
        dragging: false,
        wheeling: false,
      }
    case "hover":
      if (state.dragging || state.hovered === action.index) return state
      return { ...state, hovered: action.index }
    case "drag_on":
      return { ...state, dragging: true, wheeling: false, hovered: -1 }
    case "drag_move":
      return { ...state, pos: action.pos, dragging: true }
    case "absorbed":
      if (!state.absorb) return state
      return { ...state, absorb: false }
    case "drag_end":
      return {
        ...state,
        absorb: true,
        pos: action.pos,
        dragging: false,
        wheeling: false,
        hovered: -1,
      }
    case "wheel":
      return { ...state, pos: action.pos, wheeling: true, hovered: -1 }
    case "wheel_end":
      return { ...state, pos: action.pos, wheeling: false }
    case "jump":
      return {
        ...state,
        pos: action.pos,
        hovered: -1,
        dragging: false,
        wheeling: false,
      }
    case "drop":
      if (state.dropping === action.dropping) return state
      return { ...state, dropping: action.dropping }
    case "settle":
      if (state.phase !== "enter") return state
      return { ...state, phase: "settle" }
    case "still":
      if (state.phase !== "settle") return state
      return { ...state, phase: "still" }
    case "viewport":
      if (state.viewport === action.viewport) return state
      return { ...state, viewport: action.viewport }
    default:
      return state
  }
}

function entryEdited(entry: LibraryEntry) {
  if (entry.type === "paper") return paperEditedLabel(entry.doc.updatedAt)
  return paperEditedLabel(entry.file.createdAt)
}

function openEntry(entry: LibraryEntry, on: LibraryEntryHandlers) {
  if (entry.type === "paper") on.onOpen(entry.doc.id)
}

function insideDialog(target: EventTarget | null) {
  return (
    target instanceof Element &&
    target.closest("[data-slot='dialog-content']") !== null
  )
}

function isFileDrag(event: DragEvent) {
  const types = event.dataTransfer?.types
  return types ? Array.from(types).includes("Files") : false
}

function HandPicture({
  entry,
  page,
}: {
  entry: LibraryEntry
  page: LayoutPage | undefined
}) {
  if (entry.type === "file") {
    return (
      <PaperSheet
        badge={fileBadge(entry.file)}
        preview={
          <File
            className="absolute top-1/2 left-1/2 size-8 -translate-1/2 text-muted-foreground"
            strokeWidth={1.5}
          />
        }
      />
    )
  }
  return <LibraryDocumentSheet entry={entry} page={page} />
}

function poseStyle(pose: HandPose, entering: boolean) {
  return {
    transform: handTransform(pose, entering),
    opacity: entering ? 0 : pose.opacity,
    zIndex: pose.z,
  }
}

export function PaperHand({
  entries,
  view,
  query,
  importName,
  handlers,
  onNewCV,
  onNewLetter,
  onImport,
  onOpenImport,
  onClearSearch,
  onSearchAll,
}: {
  entries: LibraryEntry[]
  view: LibraryView
  query: string
  importName: string | null
  handlers: LibraryEntryHandlers
  onNewCV: () => void
  onNewLetter: () => void
  onImport: (files: File[]) => void
  onOpenImport: () => void
  onClearSearch: () => void
  onSearchAll: () => void
}) {
  const list = handList(entries, view, query)
  const listKey = list.map((entry) => entry.key).join("\n")
  const [hand, dispatch] = useReducer(
    paperHandReducer,
    { viewport: readViewport(), reduced: prefersReduced() },
    (seed) => initialPaperHand(seed.viewport, seed.reduced)
  )
  const handRef = useRef<HTMLDivElement>(null)
  const posRef = useRef(hand.pos)
  const onImportRef = useRef(onImport)
  const seenKey = useRef(listKey)
  const wheelTimer = useRef(0)
  const stopGesture = useRef<(() => void) | null>(null)
  const releaseTimer = useRef(0)
  useLayoutEffect(() => {
    onImportRef.current = onImport
    if (!hand.dragging && !hand.wheeling) posRef.current = hand.pos
  })
  useEffect(() => () => window.clearTimeout(releaseTimer.current), [])
  const reduced = prefersReduced()
  const step = handStep(handCardWidth(hand.viewport))
  const spread = handSpread(hand.viewport)
  const cards = handCards(list, hand.pos)
  const { data: firstPages } = useQuery(
    paperFirstPagesQuery(useOwnerId(), handPreviewIds(cards))
  )
  const count = list.length
  const centre = handCentre(hand.pos, count)
  const trimmed = query.trim()
  const searching = trimmed !== ""
  const showBlanks = view !== "proofs" && entries.length === 0 && !searching
  const showCards = view !== "proofs" && count > 0
  const showHand = showBlanks || showCards
  const shift = hand.dropping || importName !== null
  const entering = hand.phase === "enter"
  const shownIndex =
    hand.hovered >= 0 && hand.hovered < count ? hand.hovered : centre
  const shown = showCards ? list[shownIndex] : undefined

  useEffect(() => {
    function onResize() {
      dispatch({ type: "viewport", viewport: window.innerWidth })
    }
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  useEffect(() => {
    if (seenKey.current === listKey) return
    seenKey.current = listKey
    posRef.current = 0
    dispatch({ type: "reset" })
  }, [listKey])

  useEffect(() => {
    if (hand.phase !== "enter") return
    const frame = requestAnimationFrame(() => dispatch({ type: "settle" }))
    return () => cancelAnimationFrame(frame)
  }, [hand.phase, listKey])

  useEffect(() => {
    if (hand.phase !== "settle") return
    const timer = window.setTimeout(
      () => dispatch({ type: "still" }),
      motionToken("panel").duration
    )
    return () => window.clearTimeout(timer)
  }, [hand.phase, listKey])

  useEffect(() => () => stopGesture.current?.(), [])

  useEffect(() => {
    const node = handRef.current
    if (!node) return
    function onWheel(event: WheelEvent) {
      if (count < 2) return
      event.preventDefault()
      const delta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX
          : event.deltaY
      const next = handWheel(posRef.current, delta, count)
      posRef.current = next
      dispatch({ type: "wheel", pos: next })
      window.clearTimeout(wheelTimer.current)
      wheelTimer.current = window.setTimeout(() => {
        const snapped = handCentre(posRef.current, count)
        posRef.current = snapped
        dispatch({ type: "wheel_end", pos: snapped })
      }, motionToken("micro").duration)
    }
    node.addEventListener("wheel", onWheel, { passive: false })
    return () => {
      node.removeEventListener("wheel", onWheel)
      window.clearTimeout(wheelTimer.current)
    }
  }, [showHand, count])

  useEffect(() => {
    function onOver(event: DragEvent) {
      if (!isFileDrag(event)) return
      if (insideDialog(event.target)) {
        dispatch({ type: "drop", dropping: false })
        return
      }
      event.preventDefault()
      dispatch({ type: "drop", dropping: true })
    }
    function onLeave(event: DragEvent) {
      if (event.relatedTarget !== null) return
      dispatch({ type: "drop", dropping: false })
    }
    function onDrop(event: DragEvent) {
      if (!isFileDrag(event)) return
      dispatch({ type: "drop", dropping: false })
      if (insideDialog(event.target)) return
      event.preventDefault()
      const files = Array.from(event.dataTransfer?.files ?? [])
      if (files.length > 0) onImportRef.current(files)
    }
    function onEnd() {
      dispatch({ type: "drop", dropping: false })
    }
    document.addEventListener("dragover", onOver)
    document.addEventListener("dragleave", onLeave)
    document.addEventListener("drop", onDrop)
    document.addEventListener("dragend", onEnd)
    return () => {
      document.removeEventListener("dragover", onOver)
      document.removeEventListener("dragleave", onLeave)
      document.removeEventListener("drop", onDrop)
      document.removeEventListener("dragend", onEnd)
    }
  }, [])

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || count < 2) return
    const pointerId = event.pointerId
    const startX = event.clientX
    const startPos = posRef.current
    const node = event.currentTarget
    let lastX = event.clientX
    let lastT = event.timeStamp
    let velocity = 0
    let moved = false
    function lost(ev: PointerEvent) {
      finish(ev)
    }
    function finish(ev: PointerEvent) {
      if (ev.pointerId !== pointerId) return
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", finish)
      window.removeEventListener("pointercancel", finish)
      node.removeEventListener("lostpointercapture", lost)
      stopGesture.current = null
      if (!moved) return
      const released = handRelease(posRef.current, velocity, count)
      posRef.current = released
      dispatch({ type: "drag_end", pos: released })
      window.clearTimeout(releaseTimer.current)
      releaseTimer.current = window.setTimeout(
        () => dispatch({ type: "absorbed" }),
        0
      )
    }
    function move(ev: PointerEvent) {
      if (ev.pointerId !== pointerId) return
      const dx = ev.clientX - startX
      if (!moved) {
        if (Math.abs(dx) <= DRAG_START_PX) return
        moved = true
        node.setPointerCapture(pointerId)
        node.addEventListener("lostpointercapture", lost)
        window.clearTimeout(wheelTimer.current)
        dispatch({ type: "drag_on" })
      }
      const dt = Math.max(1, ev.timeStamp - lastT)
      velocity = (ev.clientX - lastX) / dt
      lastX = ev.clientX
      lastT = ev.timeStamp
      const next = handDrag(startPos, dx, step, count)
      posRef.current = next
      dispatch({ type: "drag_move", pos: next })
    }
    stopGesture.current = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", finish)
      window.removeEventListener("pointercancel", finish)
      node.removeEventListener("lostpointercapture", lost)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", finish)
    window.addEventListener("pointercancel", finish)
  }

  function onHandKey(event: ReactKeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      Home: -count,
      End: count,
    }
    const move = moves[event.key]
    if (move === undefined) return
    event.preventDefault()
    const next = handClamp(handCentre(posRef.current, count) + move, count)
    posRef.current = next
    flushSync(() => dispatch({ type: "jump", pos: next }))
    handRef.current?.querySelector<HTMLElement>("[data-centre]")?.focus()
  }

  function seek(index: number) {
    const next = handClamp(index, count)
    posRef.current = next
    dispatch({ type: "jump", pos: next })
  }

  function onCardClick(index: number, entry: LibraryEntry) {
    if (hand.absorb) {
      dispatch({ type: "absorbed" })
      return
    }
    if (index !== centre) {
      dispatch({ type: "jump", pos: index })
      return
    }
    openEntry(entry, handlers)
  }

  const ghostPose = handPose({
    index: 0,
    pos: hand.pos,
    step,
    spread,
    hovered: -1,
    shift: false,
    reduced,
  })

  function cardNodes() {
    return cards.map(({ entry, index }) => {
      const pose = handPose({
        index,
        pos: hand.pos,
        step,
        spread,
        hovered: hand.hovered,
        shift,
        reduced,
      })
      const name = entryName(entry)
      const edited = entryEdited(entry)
      const atCentre = index === centre && !pose.hidden
      const page =
        entry.type === "paper" && entry.doc.engine === 2
          ? firstPages?.find(({ id }) => id === entry.doc.id)?.page
          : undefined
      return (
        <Button
          key={entry.key}
          type="button"
          variant="ghost"
          className={cn(
            "paper-hand-card h-11 hover:bg-transparent focus-visible:border-transparent focus-visible:ring-0",
            hand.hovered === index && "is-up"
          )}
          aria-label={`Open ${name}, ${edited}`}
          aria-hidden={pose.hidden ? true : undefined}
          tabIndex={atCentre ? 0 : -1}
          data-centre={atCentre ? "" : undefined}
          data-far={pose.hidden ? "" : undefined}
          data-deal={
            hand.phase === "still"
              ? undefined
              : Math.min(3, Math.round(Math.abs(index - hand.pos)))
          }
          style={poseStyle(pose, entering)}
          onClick={() => onCardClick(index, entry)}
          onPointerMove={() => {
            if (hand.hovered !== index) dispatch({ type: "hover", index })
          }}
          onPointerLeave={() => dispatch({ type: "hover", index: -1 })}
        >
          <HandPicture entry={entry} page={page} />
        </Button>
      )
    })
  }

  const shownName = shown ? entryName(shown) : ""
  const shownEdited = shown ? entryEdited(shown) : ""

  if (showBlanks)
    return (
      <div className="paper-hand-stage">
        <PaperStartHand
          dropping={hand.dropping}
          importName={importName}
          onNewCV={onNewCV}
          onNewLetter={onNewLetter}
          onOpenImport={onOpenImport}
        />
      </div>
    )

  return (
    <div className="paper-hand-stage">
      {view === "proofs" ? (
        <div className="paper-hand-proofs">
          <PaperProofsLink />
        </div>
      ) : (
        <>
          {showHand ? (
            <div
              ref={handRef}
              role="group"
              aria-roledescription="carousel"
              aria-label="Your documents"
              className={cn(
                "paper-hand",
                entering && "is-entering",
                hand.phase === "settle" && "is-settling",
                hand.dragging && "is-dragging",
                hand.wheeling && "is-wheeling"
              )}
              onPointerDown={onPointerDown}
              onKeyDown={onHandKey}
            >
              {cardNodes()}
              {hand.dropping || importName !== null ? (
                <div
                  className="paper-hand-ghost"
                  aria-hidden="true"
                  style={poseStyle(ghostPose, false)}
                >
                  <b>{importName ?? "Drop to add"}</b>
                  {importName ? <span>Adding</span> : null}
                </div>
              ) : null}
            </div>
          ) : null}
          {shown ? (
            <PaperHandCaption
              key={view}
              name={shownName}
              edited={shownEdited}
              number={centre + 1}
              total={count}
              narrow={hand.viewport < HAND_NARROW_WIDTH}
              actions={libraryEntryActions(shown, handlers)}
              onSeek={seek}
            />
          ) : (
            <PaperHandEmpty
              copy={emptyHandCopy({
                view,
                query,
                elsewhere:
                  view === "all" ? 0 : handList(entries, "all", query).length,
                onClearSearch,
                onSearchAll,
                onNewCV,
                onNewLetter,
                onOpenImport,
              })}
            />
          )}
        </>
      )}
      {!shown && query.trim() !== "" ? null : (
        <PaperStarts
          dropping={hand.dropping}
          onNewCV={onNewCV}
          onNewLetter={onNewLetter}
          onOpenImport={onOpenImport}
        />
      )}
    </div>
  )
}
