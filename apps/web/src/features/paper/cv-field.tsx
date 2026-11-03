import { useEffect, useRef } from "react"
import { useBlockNoteEditor } from "@blocknote/react"

import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"

type FieldEditor = {
  getBlock: (id: string) =>
    | {
        id: string
        type: string
        props: Record<string, unknown>
        children: { id: string }[]
      }
    | undefined
  updateBlock: (id: string, update: unknown) => void
  insertBlocks: (
    blocks: unknown[],
    ref: string,
    placement: "after" | "first-child"
  ) => { id: string }[]
  undo: () => void
  redo: () => void
  setTextCursorPosition: (id: string, pos?: "start" | "end") => void
  focus: () => void
  document: FieldNode[]
}

type FieldNode = { id: string; type: string; children?: FieldNode[] }

const STOP = ["keyup", "mousedown", "cut", "copy", "drop"] as const

const NEXT_FIELD: Record<string, string> = {
  role: "company",
  school: "degree",
}

function flatten(blocks: FieldNode[], into: FieldNode[]) {
  for (const block of blocks) {
    into.push(block)
    if (block.children) flatten(block.children, into)
  }
}

function fieldsIn(row: ParentNode) {
  return [...row.querySelectorAll<HTMLInputElement>("[data-cv-field]")]
}

export function CvField({
  blockId,
  name,
  label,
  value,
  placeholder,
  size = "entry",
  compact = false,
  className,
  onFocusChange,
}: {
  blockId: string
  name: string
  label: string
  value: string
  placeholder?: string
  size?: "name" | "contact" | "entry" | "dates"
  compact?: boolean
  className?: string
  onFocusChange?: (focused: boolean) => void
}) {
  const editor = useBlockNoteEditor() as unknown as FieldEditor
  const ref = useRef<HTMLInputElement>(null)
  const seen = useRef(value)
  const focusChangeRef = useRef(onFocusChange)
  useEffect(() => {
    focusChangeRef.current = onFocusChange
  })
  useEffect(() => {
    const input = ref.current
    if (!input) return
    if (document.activeElement === input) {
      if (input.value !== seen.current) return
      input.value = value
      seen.current = value
      return
    }
    input.value = value
    seen.current = value
  }, [value])
  useEffect(() => {
    const input = ref.current
    if (!input) return
    let composing = false
    const claiming = { current: false }
    const historyGuard = { current: false }
    const armHistory = () => {
      historyGuard.current = true
      queueMicrotask(() => {
        historyGuard.current = false
      })
    }
    const write = (next: string) => {
      seen.current = next
      const live = editor.getBlock(blockId)
      if (!live) return
      const current = String(live.props[name] ?? "")
      if (current === next) return
      editor.updateBlock(blockId, {
        props: { ...live.props, [name]: next },
      })
    }
    const readBack = () => {
      const live = editor.getBlock(blockId)
      input.value = live ? String(live.props[name] ?? "") : input.value
      seen.current = input.value
    }
    const rowFields = () => {
      const row = input.closest("[data-cv-block-fields]")
      return row ? fieldsIn(row) : [input]
    }
    const focusNamed = (field: string) => {
      const found = rowFields().find(
        (item) => item.getAttribute("data-cv-field") === field
      )
      found?.focus()
    }
    const focusSibling = (delta: number) => {
      const fields = rowFields()
      const index = fields.indexOf(input)
      fields[index + delta]?.focus()
    }
    const leave = (dir: "up" | "down") => {
      const flat: FieldNode[] = []
      flatten(editor.document, flat)
      const index = flat.findIndex((block) => block.id === blockId)
      const target = flat[dir === "up" ? index - 1 : index + 1]
      if (!target) return
      const field = document.querySelector<HTMLElement>(
        `[data-cv-block-fields="${CSS.escape(target.id)}"] [data-cv-field]`
      )
      if (field) {
        field.focus()
        return
      }
      editor.setTextCursorPosition(target.id, dir === "up" ? "end" : "start")
      editor.focus()
    }
    const openChild = () => {
      const live = editor.getBlock(blockId)
      if (!live) return false
      const child = live.children[0]
      if (child) {
        editor.setTextCursorPosition(child.id, "start")
        editor.focus()
        return true
      }
      const type =
        live.type === "paperSkills" ? "paperSkillItem" : "bulletListItem"
      if (
        live.type !== "paperSkills" &&
        live.type !== "paperExperience" &&
        live.type !== "paperEducation"
      ) {
        return false
      }
      const created = editor.insertBlocks([{ type }], blockId, "first-child")
      const next = created[0]
      if (!next) return false
      editor.setTextCursorPosition(next.id, "start")
      editor.focus()
      return true
    }
    const claim = () => {
      focusChangeRef.current?.(true)
      if (claiming.current) return
      claiming.current = true
      try {
        editor.setTextCursorPosition(blockId, "start")
      } catch {
        claiming.current = false
      }
      if (document.activeElement !== input) input.focus()
      claiming.current = false
    }
    const onKeyDown = (event: KeyboardEvent) => {
      event.stopPropagation()
      if (event.isComposing || event.keyCode === 229 || composing) return
      const meta = event.metaKey || event.ctrlKey
      if (meta && !event.altKey && event.key.toLowerCase() === "z") {
        event.preventDefault()
        armHistory()
        if (event.shiftKey) editor.redo()
        else editor.undo()
        readBack()
        return
      }
      if (event.key === "Enter") {
        event.preventDefault()
        const fields = rowFields()
        const index = fields.indexOf(input)
        const next = fields[index + 1]
        if (next) next.focus()
        else if (!openChild()) leave("down")
        return
      }
      if (
        event.key === "Backspace" &&
        input.value === "" &&
        (input.selectionStart ?? 0) === 0
      ) {
        event.preventDefault()
        focusSibling(-1)
        return
      }
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault()
        leave(event.key === "ArrowUp" ? "up" : "down")
        return
      }
      if (event.key === "Tab") {
        event.preventDefault()
        const fields = rowFields()
        const index = fields.indexOf(input)
        const next = fields[index + (event.shiftKey ? -1 : 1)]
        if (next) next.focus()
        else leave(event.shiftKey ? "up" : "down")
        return
      }
      const pair = NEXT_FIELD[name]
      if (
        pair &&
        event.key === "ArrowRight" &&
        input.selectionStart === input.value.length &&
        input.selectionStart === input.selectionEnd
      ) {
        event.preventDefault()
        focusNamed(pair)
      }
    }
    const onInput = () => {
      if (composing || historyGuard.current) return
      write(input.value)
    }
    const onBeforeInput = (event: Event) => {
      event.stopPropagation()
      const kind = (event as InputEvent).inputType
      if (kind !== "historyUndo" && kind !== "historyRedo") return
      event.preventDefault()
      if (historyGuard.current) return
      armHistory()
      if (kind === "historyRedo") editor.redo()
      else editor.undo()
      readBack()
    }
    const onPaste = (event: ClipboardEvent) => {
      event.preventDefault()
      event.stopPropagation()
      const text = event.clipboardData?.getData("text/plain") ?? ""
      const line = text.split(/\r?\n/)[0] ?? ""
      const start = input.selectionStart ?? input.value.length
      const end = input.selectionEnd ?? start
      const next = input.value.slice(0, start) + line + input.value.slice(end)
      input.value = next
      const caret = start + line.length
      input.setSelectionRange(caret, caret)
      write(next)
    }
    const onCompositionStart = () => {
      composing = true
    }
    const onCompositionEnd = () => {
      composing = false
      write(input.value)
    }
    const stop = (event: Event) => event.stopPropagation()
    const onBlur = () => {
      readBack()
      focusChangeRef.current?.(false)
    }
    input.addEventListener("keydown", onKeyDown)
    input.addEventListener("beforeinput", onBeforeInput)
    input.addEventListener("input", onInput)
    input.addEventListener("paste", onPaste)
    input.addEventListener("compositionstart", onCompositionStart)
    input.addEventListener("compositionend", onCompositionEnd)
    input.addEventListener("focus", claim)
    input.addEventListener("blur", onBlur)
    for (const eventName of STOP) input.addEventListener(eventName, stop)
    return () => {
      input.removeEventListener("keydown", onKeyDown)
      input.removeEventListener("beforeinput", onBeforeInput)
      input.removeEventListener("input", onInput)
      input.removeEventListener("paste", onPaste)
      input.removeEventListener("compositionstart", onCompositionStart)
      input.removeEventListener("compositionend", onCompositionEnd)
      input.removeEventListener("focus", claim)
      input.removeEventListener("blur", onBlur)
      for (const eventName of STOP) input.removeEventListener(eventName, stop)
    }
  }, [editor, blockId, name])
  const input = (
    <Input
      ref={ref}
      size={1}
      defaultValue={value}
      aria-label={label}
      placeholder={placeholder}
      data-cv-field={name}
      data-cv-size={size}
      className={cn(
        "h-11 min-w-0 rounded-none border-0 bg-transparent px-0.5 py-0 shadow-none outline-none placeholder:text-muted-foreground focus-visible:border-transparent focus-visible:ring-0 md:h-7",
        compact ? "w-2" : "col-start-1 row-start-1 w-full",
        className
      )}
    />
  )
  return (
    <span
      className={cn(
        "inline-grid w-max max-w-full items-center",
        compact && "w-2",
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "invisible col-start-1 row-start-1 px-0.5 whitespace-pre",
          compact && "hidden"
        )}
        data-cv-size={size}
      >
        {value || placeholder || label}
      </span>
      {input}
    </span>
  )
}
