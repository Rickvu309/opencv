import { mountRichPaperEditor } from "@workspace/paper-crdt/editor"

type Editor = ReturnType<typeof mountRichPaperEditor>
type Options = NonNullable<Parameters<typeof mountRichPaperEditor>[2]> & {
  mounted(editor: Editor): void
  released(): void
  failed(): void
}

export function mountRichEditorLifecycle(
  client: Parameters<typeof mountRichPaperEditor>[0],
  element: HTMLElement,
  options: Options
) {
  let editor: Editor | undefined
  let selection: ReturnType<Editor["captureSelection"]>
  const emptySearch: ReturnType<Editor["search"]["snapshot"]> = {
    query: "",
    matchCase: false,
    matches: [],
    activeIndex: -1,
  }
  const liveHandle = (target: Editor): Editor => {
    const search = new Proxy(target.search, {
      get(search, key, receiver) {
        const value = Reflect.get(search, key, receiver)
        if (typeof value !== "function") return value
        return (...args: unknown[]) => {
          if (editor === target) return Reflect.apply(value, search, args)
          if (key === "snapshot") return emptySearch
          if (key === "subscribe") return () => {}
          if (key === "replace") return 0
        }
      },
    })
    return new Proxy(target, {
      get(target, key, receiver) {
        if (key === "search") return search
        const value = Reflect.get(target, key, receiver)
        if (typeof value !== "function") return value
        return (...args: unknown[]) => {
          if (editor === target) return Reflect.apply(value, target, args)
          if (key === "subscribe") return () => {}
          if (key === "photos") return []
          if (key === "activeMarks") return {}
          if (key === "documentHistory") return { undo: false, redo: false }
          if (key === "apply" || key === "focus" || key === "setLink")
            return false
          if (key === "captureSelection" || key === "restoreSelection") return
          return null
        }
      },
    })
  }
  const release = () => {
    editor?.destroy()
    editor = undefined
  }
  const mount = () => {
    try {
      editor = mountRichPaperEditor(client, element, {
        ...options,
        onRelease(captured) {
          selection = captured
          editor = undefined
          options.released()
        },
      })
      editor.restoreSelection(selection)
      options.mounted(liveHandle(editor))
    } catch {
      release()
      options.failed()
    }
  }
  const detach = client.subscribe((change) => {
    if (change === "reset") mount()
  })
  mount()
  return () => {
    detach()
    release()
  }
}
