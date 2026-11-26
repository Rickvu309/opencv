import { BetweenHorizontalStart } from "lucide-react"
import {
  ToolbarButton,
  shortcutLabel,
  type TextEditor,
} from "./rich-text-toolbar-control.tsx"
import { useToolbarGroup } from "./rich-text-toolbar-item.tsx"

export function RichPageBreak({
  editor,
  blocked,
  onAction,
}: {
  editor: TextEditor | null
  blocked: boolean
  onAction: () => void
}) {
  const label = shortcutLabel("Insert page break (Ctrl+Enter)")
  const group = useToolbarGroup([label])
  return (
    <fieldset
      {...group}
      aria-label="Insert"
      className="flex shrink-0 items-center gap-1"
    >
      <ToolbarButton
        label={label}
        disabled={!editor || blocked || !editor.canInsertPageBreak()}
        onClick={() => {
          editor?.apply(() => editor.insertPageBreak())
          onAction()
        }}
      >
        <BetweenHorizontalStart />
      </ToolbarButton>
    </fieldset>
  )
}
