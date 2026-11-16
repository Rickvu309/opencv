import { BetweenHorizontalStart } from "lucide-react"
import {
  ToolbarButton,
  shortcutLabel,
  type TextEditor,
} from "./rich-text-toolbar-control.tsx"

export function RichPageBreak({
  editor,
  blocked,
  onAction,
}: {
  editor: TextEditor | null
  blocked: boolean
  onAction: () => void
}) {
  return (
    <fieldset aria-label="Insert" className="flex shrink-0 items-center gap-1">
      <ToolbarButton
        label={shortcutLabel("Insert page break (Ctrl+Enter)")}
        disabled={!editor || blocked || !editor.canInsertPageBreak()}
        onClick={() => {
          editor?.insertPageBreak()
          onAction()
        }}
      >
        <BetweenHorizontalStart />
      </ToolbarButton>
    </fieldset>
  )
}
