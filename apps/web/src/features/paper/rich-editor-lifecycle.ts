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
      options.mounted(editor)
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
