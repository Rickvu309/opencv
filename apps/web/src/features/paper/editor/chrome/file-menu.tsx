import { Download, FileText, Keyboard } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"

type PaperDownloadFormat = "word" | "pdf"

export type PaperDownload =
  { start: (format: PaperDownloadFormat) => void } | { reason: string }

function DownloadItem({
  download,
  format,
  label,
  shortcut,
}: {
  download: PaperDownload
  format: PaperDownloadFormat
  label: string
  shortcut?: string
}) {
  if ("reason" in download)
    return (
      <DropdownMenuItem
        disabled
        className="paper-menu-row"
        title={download.reason}
      >
        <Download />
        <span className="flex flex-col">
          <span>{label}</span>
          <span className="text-xs text-muted-foreground">
            {download.reason}
          </span>
        </span>
      </DropdownMenuItem>
    )
  return (
    <DropdownMenuItem
      className="paper-menu-row"
      onClick={() => download.start(format)}
    >
      <Download />
      {label}
      {shortcut ? (
        <DropdownMenuShortcut>{shortcut}</DropdownMenuShortcut>
      ) : null}
    </DropdownMenuItem>
  )
}

export function FileMenu({
  download,
  back,
  onPageSetup,
  onShortcuts,
}: {
  download: PaperDownload
  back: () => false
  onPageSetup: () => void
  onShortcuts: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" className="paper-tool" aria-label="File" />
        }
      >
        File
      </DropdownMenuTrigger>
      <DropdownMenuContent finalFocus={back} aria-label="File">
        <DropdownMenuItem className="paper-menu-row" onClick={onPageSetup}>
          <FileText />
          Page setup
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DownloadItem download={download} format="word" label="Download Word" />
        <DownloadItem
          download={download}
          format="pdf"
          label="Download PDF"
          shortcut="Ctrl+P"
        />
        <DropdownMenuSeparator />
        <DropdownMenuItem className="paper-menu-row" onClick={onShortcuts}>
          <Keyboard />
          Keyboard shortcuts
          <DropdownMenuShortcut>Ctrl+/</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
