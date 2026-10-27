import { CommandPalette } from "@/features/command-palette/command-palette.tsx"
import type { SurfaceId } from "@/features/app-shell/surfaces.ts"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenChat: (id: string) => void
  onSurface: (id: SurfaceId) => void
}

export function SearchModal({
  open,
  onOpenChange,
  onOpenChat,
  onSurface,
}: Props) {
  return (
    <CommandPalette
      open={open}
      onOpenChange={onOpenChange}
      onOpenChat={onOpenChat}
      onSurface={onSurface}
    />
  )
}
