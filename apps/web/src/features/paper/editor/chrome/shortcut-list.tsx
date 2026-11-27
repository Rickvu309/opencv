import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Kbd, KbdGroup } from "@workspace/ui/components/kbd"

const PAPER_SHORTCUTS = [
  { keys: ["Ctrl", "Z"], label: "Undo" },
  { keys: ["Ctrl", "Shift", "Z"], label: "Redo" },
  { keys: ["Ctrl", "B"], label: "Bold" },
  { keys: ["Ctrl", "I"], label: "Italic" },
  { keys: ["Ctrl", "U"], label: "Underline" },
  { keys: ["Ctrl", "K"], label: "Link" },
  { keys: ["Ctrl", "Alt", "1"], label: "Heading" },
  { keys: ["Ctrl", "Alt", "2"], label: "Subheading" },
  { keys: ["Ctrl", "Alt", "0"], label: "Normal text" },
  { keys: ["Ctrl", "Shift", "8"], label: "Bulleted list" },
  { keys: ["Ctrl", "Shift", "7"], label: "Numbered list" },
  { keys: ["Ctrl", "]"], label: "Increase indent" },
  { keys: ["Ctrl", "["], label: "Decrease indent" },
  { keys: ["Ctrl", "\\"], label: "Clear formatting" },
  { keys: ["Ctrl", "Enter"], label: "Page break" },
  { keys: ["Ctrl", "P"], label: "Download PDF" },
  { keys: ["Ctrl", "/"], label: "Keyboard shortcuts" },
] as const

export function ShortcutList({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>On a Mac, use Cmd for Ctrl.</DialogDescription>
        </DialogHeader>
        <ul
          className="flex max-h-[60dvh] flex-col overflow-y-auto"
          aria-label="Shortcuts"
        >
          {PAPER_SHORTCUTS.map((shortcut) => (
            <li
              key={shortcut.label}
              className="flex min-h-8 items-center justify-between gap-4 text-ui"
            >
              <span>{shortcut.label}</span>
              <KbdGroup>
                {shortcut.keys.map((key) => (
                  <Kbd key={key}>{key}</Kbd>
                ))}
              </KbdGroup>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
