import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useSyncExternalStore,
} from "react"
import { cn } from "@workspace/ui/lib/utils"

import {
  adoptIds,
  blankDraft,
  clearedOnReload,
  commitComposition,
  deleteBackward,
  deleteForward,
  insertText,
  keptOnThisComputer,
  loadDraft,
  loadDraftBasis,
  pointSpan,
  replaceVisible,
  splitParagraph,
  storeDraft,
  type DraftBasis,
  type TextPoint,
  type TextSpan,
  type WritingBlock,
  type WritingDraft,
} from "./canvas-edit.ts"
import { collectLooks, withoutLooks, type LookBook } from "./canvas-look.ts"
import {
  placeCaret,
  syncParagraphs,
  textOffsetIn,
  visibleText,
  type DrawnLooks,
} from "./canvas-draw.ts"
import { pastePlain } from "./canvas-paste.ts"
import { pageWords, savedNote, settlePage } from "./canvas-save.ts"
import { holdWritingCoachFocus } from "@/lib/writing-coach-focus.ts"
import {
  setWritingConflict,
  subscribeWritingConflict,
  WRITING_CONFLICT_NOTE,
  writingConflictDoc,
} from "@/lib/writing-refresh.ts"
import "./canvas.css"
import "./design/writing-page.pen.css"

type CanvasState = {
  past: WritingDraft[]
  present: WritingDraft
  looks: LookBook
  note: string
  basis: DraftBasis | null
  typed: boolean
}

type CanvasAction =
  | {
      type: "insert"
      span: TextSpan
      text: string
      live?: { id: string; text: string }[]
      nextId?: number
    }
  | { type: "split"; span: TextSpan }
  | { type: "backward"; span: TextSpan }
  | { type: "forward"; span: TextSpan }
  | { type: "paste"; span: TextSpan; text: string }
  | {
      type: "composed"
      texts: { id: string; text: string }[]
      caret: TextPoint
      split: boolean
      nextId: number
    }
  | { type: "undo" }
  | { type: "note"; note: string }
  | { type: "adopt"; blocks: WritingBlock[] }
  | { type: "basis"; basis: DraftBasis; typed: boolean }
  | { type: "replace"; draft: WritingDraft; basis: DraftBasis }

function sameBasis(left: DraftBasis | null, right: DraftBasis | null) {
  if (left === right) return true
  if (!left || !right) return false
  return left.revision === right.revision && left.words === right.words
}

function remember(state: CanvasState, present: WritingDraft): CanvasState {
  if (JSON.stringify(state.present) === JSON.stringify(present)) return state
  return {
    ...state,
    past: state.past.concat(state.present).slice(-50),
    present,
    note: state.note === "Saved" ? keptOnThisComputer() : state.note,
    typed: true,
  }
}

function reduce(state: CanvasState, action: CanvasAction): CanvasState {
  if (action.type === "note") {
    return state.note === action.note ? state : { ...state, note: action.note }
  }
  if (action.type === "basis") {
    if (sameBasis(state.basis, action.basis) && state.typed === action.typed) {
      return state
    }
    return { ...state, basis: action.basis, typed: action.typed }
  }
  if (action.type === "replace") {
    const draft = plainDraft(action.draft)
    const looks = collectLooks(state.looks, action.draft.blocks)
    const same =
      JSON.stringify(state.present) === JSON.stringify(draft) &&
      sameBasis(state.basis, action.basis) &&
      !state.typed
    if (same) return looks === state.looks ? state : { ...state, looks }
    return {
      ...state,
      past: [],
      present: draft,
      looks,
      basis: action.basis,
      typed: false,
    }
  }
  if (action.type === "adopt") {
    const present = adoptIds(state.present, withoutLooks(action.blocks))
    const looks = collectLooks(state.looks, action.blocks)
    return present === state.present && looks === state.looks
      ? state
      : { ...state, present, looks }
  }
  if (action.type === "undo") {
    const present = state.past[state.past.length - 1]
    if (!present) return state
    const typed = state.basis
      ? pageWords(present.blocks) !== state.basis.words
      : state.typed
    return { ...state, past: state.past.slice(0, -1), present, typed }
  }
  if (action.type === "composed") {
    const visible = replaceVisible(
      { ...state.present, nextId: action.nextId },
      action.texts,
      action.caret
    )
    const present = action.split
      ? commitComposition({ ...visible, caret: action.caret }, "", true)
      : visible
    return remember(state, present)
  }
  const span = action.span
  const base =
    action.type === "insert" && action.live
      ? replaceVisible(
          { ...state.present, nextId: action.nextId ?? state.present.nextId },
          action.live,
          span.anchor
        )
      : state.present
  const present =
    action.type === "insert"
      ? insertText(base, span, action.text)
      : action.type === "split"
        ? splitParagraph(state.present, span)
        : action.type === "backward"
          ? deleteBackward(state.present, span)
          : action.type === "forward"
            ? deleteForward(state.present, span)
            : pastePlain(state.present, span, action.text)
  return remember(state, present)
}

function plainDraft(draft: WritingDraft): WritingDraft {
  return draft.blocks.some((block) => block.look)
    ? { ...draft, blocks: withoutLooks(draft.blocks) }
    : draft
}

function blockElement(node: Node | null) {
  const element =
    node?.nodeType === Node.TEXT_NODE
      ? node.parentElement
      : (node as Element | null)
  return element?.closest("p") ?? null
}

function pointFrom(
  root: HTMLElement,
  node: Node | null,
  offset: number
): TextPoint | null {
  const block = blockElement(node)
  if (!block || !root.contains(block) || !block.dataset.block) return null
  const text = (block.textContent ?? "").replaceAll("\u200b", "")
  const raw =
    node?.nodeType === Node.TEXT_NODE ? textOffsetIn(block, node, offset) : 0
  return {
    blockId: block.dataset.block,
    offset: Math.max(0, Math.min(raw, text.length)),
  }
}

function spanFrom(root: HTMLElement, fallback: TextPoint): TextSpan {
  const selection = root.ownerDocument.getSelection()
  if (!selection || selection.rangeCount === 0) return pointSpan(fallback)
  const anchor = pointFrom(root, selection.anchorNode, selection.anchorOffset)
  const focus = pointFrom(root, selection.focusNode, selection.focusOffset)
  if (!anchor || !focus) return pointSpan(fallback)
  return { anchor, focus }
}

function readBlocks(root: HTMLElement, nextId: number) {
  let minted = nextId
  const texts = [...root.querySelectorAll<HTMLElement>(":scope > p")].map(
    (block) => {
      let id = block.dataset.block
      if (!id) {
        id = `p${minted}`
        minted += 1
        block.dataset.block = id
      }
      return {
        id,
        text: (block.textContent ?? "").replaceAll("\u200b", ""),
      }
    }
  )
  return { texts, nextId: minted }
}

function withCommittedWord(
  texts: { id: string; text: string }[],
  blockId: string,
  word: string,
  base: { text: string; offset: number } | null
) {
  if (!word) return texts
  const index = texts.findIndex((item) => item.id === blockId)
  const block = texts[index]
  if (!block) return texts
  if (base && block.text !== base.text) return texts
  const at = Math.max(
    0,
    Math.min(base ? base.offset : block.text.length, block.text.length)
  )
  const next = texts.slice()
  next[index] = {
    id: block.id,
    text: block.text.slice(0, at) + word + block.text.slice(at),
  }
  return next
}

function revealCaret(page: HTMLElement, scroll: HTMLElement) {
  const node = page.ownerDocument.getSelection()?.focusNode
  const target =
    node?.nodeType === Node.TEXT_NODE
      ? node.parentElement
      : (node as HTMLElement | null)
  if (!target) return
  const caretBox = target.getBoundingClientRect()
  const frame = scroll.getBoundingClientRect()
  if (caretBox.top >= frame.top && caretBox.bottom <= frame.bottom) return
  target.scrollIntoView({ block: "nearest" })
}

function openSheet(
  docId: string,
  seed: WritingDraft | null,
  seedRevision: string | null
): CanvasState {
  const stored = loadDraft(docId, localStorage)
  const present = plainDraft(stored ?? seed ?? blankDraft())
  const basis =
    loadDraftBasis(docId, localStorage) ??
    (seedRevision
      ? { revision: seedRevision, words: pageWords(present.blocks) }
      : null)
  storeDraft(docId, present, localStorage, basis)
  return {
    past: [],
    present,
    looks: collectLooks(new Map(), seed?.blocks ?? []),
    note: pageWords(present.blocks) === "" ? keptOnThisComputer() : "",
    basis,
    typed: false,
  }
}

function WritingSheet({
  docId,
  seed,
  seedRevision,
}: {
  docId: string
  seed: WritingDraft | null
  seedRevision: string | null
}) {
  const pageRef = useRef<HTMLElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const opened = useRef(false)
  const composing = useRef(false)
  const splitAfter = useRef(false)
  const pasteGuard = useRef(false)
  const compositionBase = useRef<{
    blockId: string
    text: string
    offset: number
  } | null>(null)
  const [state, dispatch] = useReducer(reduce, null, () =>
    openSheet(docId, seed, seedRevision)
  )
  const nextId = useRef(state.present.nextId)
  const drawnLooks = useRef<DrawnLooks>(new Map())
  const conflicted = useSyncExternalStore(
    subscribeWritingConflict,
    () => writingConflictDoc() === docId,
    () => false
  )

  useEffect(() => holdWritingCoachFocus(docId), [docId])

  useEffect(() => {
    const kept = storeDraft(docId, state.present, localStorage, state.basis)
    nextId.current = state.present.nextId
    const words = pageWords(state.present.blocks)
    if (!kept) {
      dispatch({ type: "note", note: clearedOnReload() })
      return
    }
    if (words === "" || state.typed) {
      dispatch({ type: "note", note: keptOnThisComputer() })
    }
    const controller = new AbortController()
    void settlePage(docId, state.present.blocks, controller.signal, {
      basis: state.basis,
      typed: state.typed,
      caret: state.present.caret,
    })
      .then((result) => {
        if (controller.signal.aborted) return
        if (result.conflict) {
          setWritingConflict(docId)
          return
        }
        if (result.replace && result.basis) {
          setWritingConflict(null)
          dispatch({
            type: "replace",
            draft: result.replace,
            basis: result.basis,
          })
          return
        }
        if (result.basis) {
          dispatch({ type: "basis", basis: result.basis, typed: false })
        }
        if (result.blocks) dispatch({ type: "adopt", blocks: result.blocks })
        const note = savedNote(words, result)
        if (note) {
          if (note === "Saved") setWritingConflict(null)
          dispatch({ type: "note", note })
          return
        }
        if (!state.typed && words !== "") {
          dispatch({ type: "note", note: keptOnThisComputer() })
        }
      })
      .catch(() => undefined)
    return () => controller.abort()
  }, [docId, state.basis, state.present, state.typed])

  useLayoutEffect(() => {
    const page = pageRef.current
    const scroll = scrollRef.current
    if (!page || composing.current) return
    syncParagraphs(
      page,
      state.present.blocks,
      state.looks,
      state.present.caret,
      drawnLooks.current
    )
    if (!opened.current) {
      page.focus({ preventScroll: true })
      if (scroll) scroll.scrollTop = 0
      opened.current = true
    }
    placeCaret(page, state.present.caret)
    if (scroll) revealCaret(page, scroll)
  }, [state.present, state.looks])

  const applyPaste = useCallback(
    (text: string) => {
      const page = pageRef.current
      if (!page || pasteGuard.current) return
      pasteGuard.current = true
      dispatch({
        type: "paste",
        span: spanFrom(page, state.present.caret),
        text,
      })
      queueMicrotask(() => {
        pasteGuard.current = false
      })
    },
    [state.present]
  )

  useEffect(() => {
    const page = pageRef.current
    if (!page) return
    const onBefore = (event: Event) => {
      if (composing.current) return
      const input = event as InputEvent
      if (typeof input.inputType !== "string") return
      const span = spanFrom(page, state.present.caret)
      if (
        state.present.blocks.some(
          (block) =>
            block.held &&
            (block.id === span.anchor.blockId ||
              block.id === span.focus.blockId)
        )
      ) {
        event.preventDefault()
        return
      }
      if (
        input.inputType === "insertCompositionText" ||
        input.inputType === "insertParagraph"
      ) {
        return
      }
      if (input.inputType === "insertFromPaste") {
        event.preventDefault()
        applyPaste(input.data ?? "")
        return
      }
      if (input.inputType === "insertText") {
        event.preventDefault()
        const live = readBlocks(page, state.present.nextId)
        dispatch({
          type: "insert",
          span,
          text: input.data ?? "",
          live: live.texts,
          nextId: live.nextId,
        })
        return
      }
      if (input.inputType === "deleteContentBackward") {
        event.preventDefault()
        dispatch({ type: "backward", span })
        return
      }
      if (input.inputType === "deleteContentForward") {
        event.preventDefault()
        dispatch({ type: "forward", span })
      }
    }
    page.addEventListener("beforeinput", onBefore)
    return () => page.removeEventListener("beforeinput", onBefore)
  }, [applyPaste, state.present])

  return (
    <section
      aria-label="Writing"
      className="writing-sheet"
      data-pen-surface="paper-page"
    >
      <div className="writing-scroll" ref={scrollRef}>
        <article
          ref={pageRef}
          className={cn("writing-page")}
          contentEditable
          suppressContentEditableWarning
          spellCheck
          aria-label="Page"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              if (
                state.present.blocks.some(
                  (block) =>
                    block.held && block.id === state.present.caret.blockId
                )
              ) {
                return
              }
              const native = event.nativeEvent
              if (native.isComposing || native.keyCode === 229) {
                splitAfter.current = true
                return
              }
              const page = pageRef.current
              if (!page) return
              dispatch({
                type: "split",
                span: spanFrom(page, state.present.caret),
              })
              return
            }
            if (
              (event.metaKey || event.ctrlKey) &&
              event.key.toLowerCase() === "z" &&
              !event.shiftKey
            ) {
              event.preventDefault()
              dispatch({ type: "undo" })
            }
          }}
          onCompositionStart={() => {
            composing.current = true
            const caret = state.present.caret
            const block = state.present.blocks.find(
              (item) => item.id === caret.blockId
            )
            compositionBase.current = {
              blockId: caret.blockId,
              text: block?.text ?? "",
              offset: caret.offset,
            }
          }}
          onCompositionEnd={(event) => {
            composing.current = false
            const page = pageRef.current
            const base = compositionBase.current
            compositionBase.current = null
            if (!page) return
            const read = readBlocks(page, nextId.current)
            nextId.current = read.nextId
            const selected =
              pointFrom(
                page,
                page.ownerDocument.getSelection()?.focusNode ?? null,
                page.ownerDocument.getSelection()?.focusOffset ?? 0
              ) ?? state.present.caret
            const grew = read.texts.length > state.present.blocks.length
            const split = splitAfter.current && !grew
            splitAfter.current = false
            const target =
              base && read.texts.some((item) => item.id === base.blockId)
                ? base.blockId
                : selected.blockId
            const texts = withCommittedWord(
              read.texts,
              target,
              event.data,
              base && base.blockId === target ? base : null
            )
            const block = texts.find((item) => item.id === target) ?? texts[0]
            const caret = split
              ? {
                  blockId: block?.id ?? target,
                  offset: block?.text.length ?? 0,
                }
              : selected
            dispatch({
              type: "composed",
              texts,
              caret,
              split,
              nextId: read.nextId,
            })
          }}
          onPaste={(event) => {
            event.preventDefault()
            applyPaste(event.clipboardData.getData("text/plain"))
          }}
        >
          {state.present.blocks.map((block) => (
            <Fragment key={block.id}>
              <p
                data-block={block.id}
                contentEditable={block.held ? false : undefined}
              >
                {visibleText(block.text)}
              </p>
              {block.held && block.reason ? (
                <div className="text-xs text-muted-foreground">
                  {block.reason}
                </div>
              ) : null}
            </Fragment>
          ))}
        </article>
      </div>
      <p className="writing-note" role="status">
        {conflicted ? WRITING_CONFLICT_NOTE : state.note}
      </p>
    </section>
  )
}

export function WritingCanvas({
  docId,
  seed = null,
  seedRevision = null,
}: {
  docId: string
  seed?: WritingDraft | null
  seedRevision?: string | null
}) {
  return (
    <WritingSheet
      key={docId}
      docId={docId}
      seed={seed}
      seedRevision={seedRevision}
    />
  )
}
