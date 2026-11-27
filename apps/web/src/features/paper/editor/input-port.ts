import { keyAction, type KeyAction } from "./keymap.ts"

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
