import { revealCaret, useCanvasScale } from "./canvas-viewport.ts"
import { writingStorage } from "./canvas-branch.ts"
import {
  Fragment,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useSyncExternalStore,
} from "react"
import { cn } from "@workspace/ui/lib/utils"

import { useWritingReconnect } from "./canvas-reconnect.ts"
import { RecoveryBar } from "./canvas-recovery.tsx"
import { selectRecovery } from "./canvas-recovery-select.ts"
import type { Recovery } from "./canvas-branch.ts"

import { wordDownloadRevision } from "./canvas-download.ts"

import {
  clearedOnReload,
  keptOnThisComputer,
  pointSpan,
  storeDraft,
  type TextPoint,
  type TextSpan,
  type WritingDraft,
} from "./canvas-edit.ts"
import { inputRule, pageKey, type PageEdit } from "./canvas-input.ts"
import { openSheet, reduce, type CanvasAction } from "./canvas-state.ts"
import { markedLines, unsavedBar } from "./canvas-unsaved.ts"
import { UnsavedBar } from "./canvas-unsaved-bar.tsx"
import {
  placeCaret,
  syncParagraphs,
  textOffsetIn,
  visibleText,
  type DrawnLooks,
} from "./canvas-draw.ts"
import { screenLooks } from "./canvas-look.ts"
import { pageWords, settlePage } from "./canvas-save.ts"
import { holdWritingCoachFocus } from "@/lib/writing-coach-focus.ts"
import {
  setWritingConflict,
  subscribeWritingConflict,
  WRITING_CONFLICT_NOTE,
  writingConflictDoc,
} from "@/lib/writing-refresh.ts"
import "./canvas.css"
import "./design/writing-page.pen.css"

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
    node?.nodeType === Node.TEXT_NODE
      ? textOffsetIn(block, node, offset)
      : node && offset > 0
        ? textBefore(block, node, offset)
        : 0
  return {
    blockId: block.dataset.block,
    offset: Math.max(0, Math.min(raw, text.length)),
  }
}

function textBefore(block: HTMLElement, node: Node, offset: number) {
  const range = block.ownerDocument.createRange()
  range.setStart(block, 0)
  range.setEnd(node, offset)
  return range.toString().replaceAll("\u200b", "").length
}

function targetSpan(root: HTMLElement, input: InputEvent): TextSpan | null {
  const range =
    typeof input.getTargetRanges === "function"
      ? input.getTargetRanges()[0]
      : undefined
  if (!range) return null
  const anchor = pointFrom(root, range.startContainer, range.startOffset)
  const focus = pointFrom(root, range.endContainer, range.endOffset)
  return anchor && focus ? { anchor, focus } : null
}

function editAction(
  edit: PageEdit,
  span: TextSpan,
  target: TextSpan | null,
  input: InputEvent
): CanvasAction | null {
  if (edit.kind === "undo" || edit.kind === "redo") return { type: edit.kind }
  if (edit.kind === "split") return { type: "split", span }
  if (edit.kind === "replace") {
    const text = input.data ?? input.dataTransfer?.getData("text/plain") ?? ""
    return { type: "insert", span: target ?? span, text }
  }
  if (edit.kind === "delete") {
    const wide = edit.reach === "word" || edit.reach === "line"
    return {
      type: "delete",
      span: wide && target ? target : span,
      direction: edit.direction,
      reach: edit.reach,
    }
  }
  return null
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

function WritingSheet({
  docId,
  seed,
  seedRevision,
  renderHeader,
}: {
  docId: string
  seed: WritingDraft | null
  seedRevision: string | null
  renderHeader?: (
    note: string,
    revision: string | null,
    text: string
  ) => ReactNode
}) {
  const pageRef = useRef<HTMLElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const opened = useRef(false)
  const composing = useRef(false)
  const splitAfter = useRef(false)
  const pasteGuard = useRef(false)
  const compositionSpan = useRef<TextSpan | null>(null)
  const drawnFor = useRef(0)
  const compositionBase = useRef<{
    blockId: string
    text: string
    offset: number
  } | null>(null)
  const [state, dispatch] = useReducer(reduce, null, () =>
    openSheet(docId, seed, seedRevision)
  )
  const connection = useWritingReconnect(
    docId,
    !state.recovering && !state.moved && !state.pageRefusal
  )
  const nextId = useRef(state.present.nextId)
  const heldBack = useRef<CanvasAction[]>([])
  const deliver = useCallback((action: CanvasAction) => {
    if (composing.current) heldBack.current.push(action)
    else dispatch(action)
  }, [])
  const flushHeldBack = useCallback(() => {
    const held = heldBack.current
    heldBack.current = []
    for (const action of held) dispatch(action)
  }, [])
  const drawnLooks = useRef<DrawnLooks>(new Map())
  const conflicted = useSyncExternalStore(
    subscribeWritingConflict,
    () => writingConflictDoc() === docId,
    () => false
  )

  useCanvasScale(pageRef, scrollRef, state.redraw)

  useEffect(() => holdWritingCoachFocus(docId), [docId])

  const latest = useRef(state)
  const stored = useRef(true)
  const settlement = useRef<AbortController | null>(null)
  const recovering = useRef(false)
  useLayoutEffect(() => {
    latest.current = state
  })

  useEffect(() => {
    stored.current = storeDraft(
      docId,
      state.present,
      writingStorage,
      state.basis,
      { saved: state.saved, unsaved: state.unsaved }
    )
    nextId.current = state.present.nextId
    if (!stored.current) dispatch({ type: "note", note: clearedOnReload() })
  }, [docId, state.present, state.basis, state.saved, state.unsaved])

  useEffect(() => {
    if (state.recovering) return
    const words = pageWords(state.present.blocks)
    const typed = state.typed
    if (words === "" || typed) {
      dispatch({
        type: "note",
        note: stored.current ? keptOnThisComputer() : clearedOnReload(),
      })
    }
    const controller = new AbortController()
    settlement.current = controller
    void settlePage(docId, state.present.blocks, controller.signal, {
      basis: state.basis,
      typed,
      caret: state.present.caret,
      refused: latest.current.unsaved,
    })
      .then((outcome) => {
        if (controller.signal.aborted) return
        if (outcome.moved) setWritingConflict(docId)
        else if (outcome.saved || outcome.replace) setWritingConflict(null)
        deliver({ type: "settled", outcome, words, typed })
        if (!stored.current && !outcome.saved && !outcome.note)
          dispatch({
            type: "note",
            note: outcome.local ? keptOnThisComputer() : clearedOnReload(),
          })
      })
      .catch(() => undefined)
    return () => controller.abort()
  }, [
    deliver,
    docId,
    state.present,
    state.basis,
    state.typed,
    state.recovering,
    conflicted,
    connection,
  ])

  useLayoutEffect(() => {
    composing.current = false
    compositionBase.current = null
    compositionSpan.current = null
  }, [state.redraw])

  useLayoutEffect(() => {
    const page = pageRef.current
    const scroll = scrollRef.current
    if (!page || composing.current) return
    syncParagraphs(
      page,
      state.present.blocks,
      screenLooks(state.present.blocks, state.looks, state.saved?.blocks),
      state.present.caret,
      drawnLooks.current
    )
    if (!opened.current) {
      page.focus({ preventScroll: true })
      if (scroll) scroll.scrollTop = 0
      opened.current = true
    }
    if (drawnFor.current !== state.redraw) {
      drawnFor.current = state.redraw
      page.focus({ preventScroll: true })
    }
    placeCaret(page, state.present.caret)
    if (scroll) revealCaret(page, scroll)
  }, [state.present, state.looks, state.saved, state.redraw])

  const bar = unsavedBar(state)
  const marked = markedLines(state).join(" ")

  useLayoutEffect(() => {
    const page = pageRef.current
    if (!page || composing.current) return
    const ids = new Set(marked.split(" "))
    for (const node of page.querySelectorAll<HTMLElement>(":scope > p")) {
      if (ids.has(node.dataset.block ?? ""))
        node.setAttribute("data-unsaved", "")
      else node.removeAttribute("data-unsaved")
    }
  }, [marked, state.present, state.redraw])

  const recover = useCallback(
    (selected: Recovery | null) => {
      if (recovering.current) return
      recovering.current = true
      settlement.current?.abort()
      dispatch({ type: "recovering", active: true })
      void selectRecovery(docId, selected)
        .then((next) => {
          setWritingConflict(null)
          recovering.current = false
          dispatch({ type: "recovered", state: next })
        })
        .catch((error: unknown) => {
          recovering.current = false
          dispatch({ type: "recovering", active: false })
          dispatch({
            type: "notice",
            notice:
              error instanceof Error
                ? error.message
                : "This copy could not be opened. Your words are still here.",
          })
        })
    },
    [docId]
  )
  const takeSavedPage = useCallback(() => recover(null), [recover])

  const restoreLine = useCallback((id: string) => {
    dispatch({ type: "restoreLine", id })
  }, [])

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
      const rule = inputRule(input.inputType)
      if (rule.kind === "native") return
      event.preventDefault()
      if (rule.kind === "blocked") {
        if (rule.notice) dispatch({ type: "notice", notice: rule.notice })
        return
      }
      const edit = rule.edit
      if (edit.kind === "undo" || edit.kind === "redo") {
        dispatch({ type: edit.kind })
        return
      }
      const span = spanFrom(page, state.present.caret)
      if (
        state.present.blocks.some(
          (block) =>
            block.held &&
            (block.id === span.anchor.blockId ||
              block.id === span.focus.blockId)
        )
      ) {
        return
      }
      if (edit.kind === "paste") {
        applyPaste(
          input.data ?? input.dataTransfer?.getData("text/plain") ?? ""
        )
        return
      }
      if (edit.kind === "type") {
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
      const action = editAction(edit, span, targetSpan(page, input), input)
      if (action) dispatch(action)
    }
    const onInput = (event: Event) => {
      if (composing.current) return
      const input = event as InputEvent
      if (typeof input.inputType !== "string") return
      if (inputRule(input.inputType).kind === "native") return
      dispatch({ type: "redraw" })
    }
    page.addEventListener("beforeinput", onBefore)
    page.addEventListener("input", onInput)
    return () => {
      page.removeEventListener("beforeinput", onBefore)
      page.removeEventListener("input", onInput)
    }
  }, [applyPaste, state.present, state.redraw])

  return (
    <section
      aria-label="Writing"
      className="writing-sheet"
      data-pen-surface="paper-page"
    >
      {renderHeader?.(
        conflicted ? WRITING_CONFLICT_NOTE : state.note,
        wordDownloadRevision(
          conflicted ? WRITING_CONFLICT_NOTE : state.note,
          pageWords(state.present.blocks),
          state.basis
        ),
        pageWords(state.present.blocks)
      )}
      <RecoveryBar key={state.redraw} docId={docId} onRecover={recover} />
      <UnsavedBar
        key={bar.cause ?? "none"}
        model={bar}
        onUseSaved={takeSavedPage}
        onRestore={restoreLine}
      />
      <div className="writing-scroll" ref={scrollRef}>
        <div className="writing-page-viewport" data-paper-page-viewport>
          <article
            key={state.redraw}
            ref={pageRef}
            className={cn("writing-page")}
            aria-busy={state.recovering}
            contentEditable={!state.recovering}
            suppressContentEditableWarning
            spellCheck
            aria-label="Page"
            onKeyDown={(event) => {
              const key = pageKey(event)
              if (!key) return
              event.preventDefault()
              if (key === "undo" || key === "redo") {
                dispatch({ type: key })
                return
              }
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
            }}
            onCompositionStart={() => {
              composing.current = true
              const page = pageRef.current
              const span = page ? spanFrom(page, state.present.caret) : null
              compositionSpan.current = span
              const caret = span ? span.focus : state.present.caret
              const block = state.present.blocks.find(
                (item) => item.id === caret.blockId
              )
              compositionBase.current = {
                blockId: caret.blockId,
                text: block?.text ?? "",
                offset: caret.offset,
              }
            }}
            onBlur={() => {
              if (!composing.current) return
              composing.current = false
              compositionBase.current = null
              compositionSpan.current = null
              flushHeldBack()
            }}
            onCompositionEnd={(event) => {
              composing.current = false
              const page = pageRef.current
              const base = compositionBase.current
              const from = compositionSpan.current
              compositionBase.current = null
              compositionSpan.current = null
              if (!page) {
                flushHeldBack()
                return
              }
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
                from,
                split,
                nextId: read.nextId,
              })
              flushHeldBack()
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
      </div>
      {!renderHeader || conflicted || state.notice ? (
        <p
          className="writing-note"
          role={renderHeader && conflicted ? undefined : "status"}
        >
          {conflicted ? (
            WRITING_CONFLICT_NOTE
          ) : state.notice ? (
            <span key={state.notice} className="writing-notice">
              {state.notice}
            </span>
          ) : (
            state.note
          )}
        </p>
      ) : null}
    </section>
  )
}

export function WritingCanvas({
  docId,
  seed = null,
  seedRevision = null,
  renderHeader,
}: {
  docId: string
  seed?: WritingDraft | null
  seedRevision?: string | null
  renderHeader?: (
    note: string,
    revision: string | null,
    text: string
  ) => ReactNode
}) {
  return (
    <WritingSheet
      key={docId}
      docId={docId}
      seed={seed}
      seedRevision={seedRevision}
      renderHeader={renderHeader}
    />
  )
}
