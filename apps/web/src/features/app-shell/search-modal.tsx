import { CommandPalette } from "@/features/command-palette/command-palette.tsx"
import type { SearchThread } from "@/features/app-shell/search-threads.ts"
import type { SurfaceId } from "@/features/app-shell/surfaces.ts"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  threads: SearchThread[]
  onNewThread: () => void
  onOpenThread: (id: string) => void
  onSurface: (id: SurfaceId) => void
}

export function SearchModal({
  open,
  onOpenChange,
  onOpenThread,
  onSurface,
}: Props) {
  return (
    <CommandPalette
      open={open}
      onOpenChange={onOpenChange}
      onOpenThread={onOpenThread}
      onSurface={onSurface}
    />
  )
}
