import type { PagePoint } from "@workspace/paper-engine"

export type KeyFacts = {
  key: string
  code: string
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  altKey: boolean
}

export type MoveUnit = "char" | "word" | "line" | "lineEdge" | "doc"

export type KeyAction =
  | { do: "move"; unit: MoveUnit; dir: -1 | 1; extend: boolean }
  | { do: "selectAll" }
  | { do: "undo" }
  | { do: "redo" }
  | { do: "mark"; mark: "bold" | "italic" | "underline" }
  | { do: "link" }
  | { do: "clearFormatting" }
  | { do: "kind"; kind: "paragraph" | "heading" | "subheading" }
  | { do: "list"; list: "bullet" | "numbered" }
  | { do: "level"; by: -1 | 1 }
  | { do: "enter" }
  | { do: "lineBreak" }
  | { do: "pageBreak" }
  | { do: "backspace"; word: boolean }
  | { do: "delete"; word: boolean }
  | { do: "tab"; by: -1 | 1 }

const MARKS = { b: "bold", i: "italic", u: "underline" } as const
const KINDS = {
  Digit0: "paragraph",
  Digit1: "heading",
  Digit2: "subheading",
} as const
const ARROWS: Record<string, -1 | 1> = { ArrowLeft: -1, ArrowRight: 1 }
const VERTICAL: Record<string, -1 | 1> = { ArrowUp: -1, ArrowDown: 1 }

function modified(facts: KeyFacts, mod: boolean): KeyAction | null {
  const key = facts.key.toLowerCase()
  if (facts.altKey && facts.code in KINDS)
    return { do: "kind", kind: KINDS[facts.code as keyof typeof KINDS] }
  if (facts.altKey) return null
  if (facts.shiftKey && facts.code === "Digit7")
    return { do: "list", list: "numbered" }
  if (facts.shiftKey && facts.code === "Digit8")
    return { do: "list", list: "bullet" }
  if (key === "z") return facts.shiftKey ? { do: "redo" } : { do: "undo" }
  if (key === "y" && !facts.shiftKey) return { do: "redo" }
  if (key === "a" && !facts.shiftKey) return { do: "selectAll" }
  if (key in MARKS && !facts.shiftKey)
    return { do: "mark", mark: MARKS[key as keyof typeof MARKS] }
  if (key === "k" && !facts.shiftKey) return { do: "link" }
  if (facts.code === "Backslash") return { do: "clearFormatting" }
  if (facts.code === "BracketRight") return { do: "level", by: 1 }
  if (facts.code === "BracketLeft") return { do: "level", by: -1 }
  if (facts.key === "Enter") return { do: "pageBreak" }
  if (facts.key === "Home")
    return { do: "move", unit: "doc", dir: -1, extend: facts.shiftKey }
  if (facts.key === "End")
    return { do: "move", unit: "doc", dir: 1, extend: facts.shiftKey }
  if (facts.key in ARROWS && mod)
    return {
      do: "move",
      unit: "word",
      dir: ARROWS[facts.key]!,
      extend: facts.shiftKey,
    }
  if (facts.key === "Backspace") return { do: "backspace", word: true }
  if (facts.key === "Delete") return { do: "delete", word: true }
  return null
}

export function keyAction(facts: KeyFacts): KeyAction | null {
  const mod = facts.ctrlKey || facts.metaKey
  if (mod) return modified(facts, mod)
  const extend = facts.shiftKey
  if (facts.altKey && facts.key in ARROWS)
    return { do: "move", unit: "word", dir: ARROWS[facts.key]!, extend }
  if (facts.altKey && facts.key === "Backspace")
    return { do: "backspace", word: true }
  if (facts.altKey) return null
  if (facts.key in ARROWS)
    return { do: "move", unit: "char", dir: ARROWS[facts.key]!, extend }
  if (facts.key in VERTICAL)
    return { do: "move", unit: "line", dir: VERTICAL[facts.key]!, extend }
  if (facts.key === "Home")
    return { do: "move", unit: "lineEdge", dir: -1, extend }
  if (facts.key === "End")
    return { do: "move", unit: "lineEdge", dir: 1, extend }
  if (facts.key === "Enter")
    return facts.shiftKey ? { do: "lineBreak" } : { do: "enter" }
  if (facts.key === "Backspace") return { do: "backspace", word: false }
  if (facts.key === "Delete") return { do: "delete", word: false }
  if (facts.key === "Tab") return { do: "tab", by: facts.shiftKey ? -1 : 1 }
  return null
}

export type Mirror = {
  value: string
  start: number
  end: number
  backward: boolean
}

export type TextareaEdit = { from: number; to: number; text: string }

export type InputKind =
  { kind: "typing" } | { kind: "composition"; id: string; oneShot: boolean }

export type InputSink = {
  mirror(): Mirror
  replace(edit: TextareaEdit, caret: number, input: InputKind): void
  action(action: KeyAction): void
  pasteText(text: string): void
  copyText(): string
  cutText(): string
  composing(active: boolean): void
}

export type InputPort = {
  element: HTMLTextAreaElement
  sync(): void
  isComposing(): boolean
  destroy(): void
}

const isHighSurrogate = (code: number) => code >= 0xd800 && code <= 0xdbff

export function textareaDiff(
  previous: { value: string; start: number },
  current: { value: string; start: number }
): TextareaEdit | null {
  const before = previous.value
  const after = current.value
  const limit = Math.min(
    previous.start,
    current.start,
    before.length,
    after.length
  )
  let prefix = 0
  while (prefix < limit && before[prefix] === after[prefix]) prefix += 1
  if (prefix > 0 && isHighSurrogate(before.charCodeAt(prefix - 1))) prefix -= 1
  let suffix = 0
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  )
    suffix += 1
  if (
    suffix > 0 &&
    isHighSurrogate(before.charCodeAt(before.length - suffix - 1))
  )
    suffix -= 1
  const to = before.length - suffix
  const text = after.slice(prefix, after.length - suffix)
  if (prefix === to && text === "") return null
  return { from: prefix, to, text }
}

export function createInputPort(sink: InputSink): InputPort {
  const element = document.createElement("textarea")
  element.className = "paper-input"
  element.setAttribute("autocomplete", "off")
  element.setAttribute("autocapitalize", "sentences")
  element.setAttribute("aria-label", "Paper page")
  element.setAttribute("aria-multiline", "true")
  element.spellcheck = false
  element.wrap = "off"
  let last: Mirror = { value: "", start: 0, end: 0, backward: false }
  let composition: { id: string; inputs: number } | null = null
  let ended: { id: string; inputs: number } | null = null
  let counter = 0

  const write = () => {
    last = sink.mirror()
    if (element.value !== last.value) element.value = last.value
    if (
      element.selectionStart !== last.start ||
      element.selectionEnd !== last.end
    )
      element.setSelectionRange(
        last.start,
        last.end,
        last.backward ? "backward" : "forward"
      )
  }

  const take = (input: InputKind) => {
    const current = {
      value: element.value,
      start: element.selectionStart,
      end: element.selectionEnd,
    }
    const edit = textareaDiff(last, current)
    last = { ...current, backward: false }
    if (edit) sink.replace(edit, current.start, input)
    return edit !== null
  }

  const onInput = (event: Event) => {
    const data = event as InputEvent
    if (composition) {
      composition.inputs += 1
      take({ kind: "composition", id: composition.id, oneShot: false })
      return
    }
    if (ended && data.inputType === "insertCompositionText") {
      take({ kind: "composition", id: ended.id, oneShot: ended.inputs === 0 })
      ended = null
      write()
      return
    }
    ended = null
    take({ kind: "typing" })
    write()
  }

  const onCompositionStart = () => {
    counter += 1
    composition = { id: `ime-${counter}`, inputs: 0 }
    ended = null
    sink.composing(true)
  }

  const onCompositionEnd = () => {
    const open = composition
    composition = null
    if (!open) return
    take({ kind: "composition", id: open.id, oneShot: open.inputs === 0 })
    ended = open
    sink.composing(false)
    write()
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (composition || event.isComposing || event.keyCode === 229) return
    const action = keyAction(event)
    if (!action) return
    event.preventDefault()
    ended = null
    sink.action(action)
    write()
  }

  const onBeforeInput = (event: InputEvent) => {
    if (composition || event.isComposing) return
    const caretAtStart =
      element.selectionStart === 0 && element.selectionEnd === 0
    const caretAtEnd =
      element.selectionStart === element.value.length &&
      element.selectionEnd === element.value.length
    const actions: Record<string, KeyAction | null> = {
      historyUndo: { do: "undo" },
      historyRedo: { do: "redo" },
      insertParagraph: { do: "enter" },
      insertLineBreak: { do: "lineBreak" },
      formatBold: { do: "mark", mark: "bold" },
      formatItalic: { do: "mark", mark: "italic" },
      formatUnderline: { do: "mark", mark: "underline" },
      deleteContentBackward: caretAtStart
        ? { do: "backspace", word: false }
        : null,
      deleteContentForward: caretAtEnd ? { do: "delete", word: false } : null,
    }
    const action = actions[event.inputType]
    if (!action) return
    event.preventDefault()
    sink.action(action)
    write()
  }

  const onPaste = (event: ClipboardEvent) => {
    event.preventDefault()
    const text = event.clipboardData?.getData("text/plain") ?? ""
    if (text) sink.pasteText(text)
    write()
  }

  const onCopy = (event: ClipboardEvent) => {
    event.preventDefault()
    event.clipboardData?.setData("text/plain", sink.copyText())
  }

  const onCut = (event: ClipboardEvent) => {
    event.preventDefault()
    event.clipboardData?.setData("text/plain", sink.cutText())
    write()
  }

  element.addEventListener("input", onInput)
  element.addEventListener("compositionstart", onCompositionStart)
  element.addEventListener("compositionend", onCompositionEnd)
  element.addEventListener("keydown", onKeyDown)
  element.addEventListener("beforeinput", onBeforeInput)
  element.addEventListener("paste", onPaste)
  element.addEventListener("copy", onCopy)
  element.addEventListener("cut", onCut)

  return {
    element,
    isComposing: () => composition !== null,
    sync: () => {
      if (!composition) write()
    },
    destroy: () => {
      element.removeEventListener("input", onInput)
      element.removeEventListener("compositionstart", onCompositionStart)
      element.removeEventListener("compositionend", onCompositionEnd)
      element.removeEventListener("keydown", onKeyDown)
      element.removeEventListener("beforeinput", onBeforeInput)
      element.removeEventListener("paste", onPaste)
      element.removeEventListener("copy", onCopy)
      element.removeEventListener("cut", onCut)
      element.remove()
    },
  }
}

export type PointerSink = {
  pointAt(clientX: number, clientY: number): PagePoint | null
  press(point: PagePoint, clicks: number, extend: boolean): void
  drag(point: PagePoint): void
  focus(): void
}

const MULTI_CLICK_MS = 500
const MULTI_CLICK_PX = 4
const TAP_SLOP_PX = 8

export function attachPointer(surface: HTMLElement, sink: PointerSink) {
  let clicks = 0
  let lastDown = { at: -Infinity, x: 0, y: 0 }
  let dragging: number | null = null
  let touch: { id: number; x: number; y: number } | null = null

  const onDown = (event: PointerEvent) => {
    if (event.button !== 0) return
    if (event.pointerType !== "mouse") {
      touch = { id: event.pointerId, x: event.clientX, y: event.clientY }
      return
    }
    event.preventDefault()
    const near =
      event.timeStamp - lastDown.at < MULTI_CLICK_MS &&
      Math.abs(event.clientX - lastDown.x) <= MULTI_CLICK_PX &&
      Math.abs(event.clientY - lastDown.y) <= MULTI_CLICK_PX
    clicks = near ? (clicks % 3) + 1 : 1
    lastDown = { at: event.timeStamp, x: event.clientX, y: event.clientY }
    sink.focus()
    const point = sink.pointAt(event.clientX, event.clientY)
    if (!point) return
    sink.press(point, clicks, event.shiftKey)
    if (clicks === 1) {
      dragging = event.pointerId
      surface.setPointerCapture(event.pointerId)
    }
  }

  const onMove = (event: PointerEvent) => {
    if (dragging !== event.pointerId) return
    const point = sink.pointAt(event.clientX, event.clientY)
    if (point) sink.drag(point)
  }

  const onUp = (event: PointerEvent) => {
    if (dragging === event.pointerId) {
      dragging = null
      if (surface.hasPointerCapture(event.pointerId))
        surface.releasePointerCapture(event.pointerId)
      return
    }
    if (!touch || touch.id !== event.pointerId) return
    const moved =
      Math.abs(event.clientX - touch.x) > TAP_SLOP_PX ||
      Math.abs(event.clientY - touch.y) > TAP_SLOP_PX
    touch = null
    if (moved) return
    sink.focus()
    const point = sink.pointAt(event.clientX, event.clientY)
    if (point) sink.press(point, 1, false)
  }

  const onCancel = () => {
    dragging = null
    touch = null
  }

  surface.addEventListener("pointerdown", onDown)
  surface.addEventListener("pointermove", onMove)
  surface.addEventListener("pointerup", onUp)
  surface.addEventListener("pointercancel", onCancel)
  return () => {
    surface.removeEventListener("pointerdown", onDown)
    surface.removeEventListener("pointermove", onMove)
    surface.removeEventListener("pointerup", onUp)
    surface.removeEventListener("pointercancel", onCancel)
  }
}
