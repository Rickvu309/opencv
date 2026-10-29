import { Settings } from "lucide-react"
import { Link } from "@tanstack/react-router"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"

import { profileInitials } from "@/features/app-shell/profile-display.ts"
import { shellCopy } from "@/features/app-shell/shell-copy.ts"
import { SURFACE_PATHS } from "@/lib/product-paths.ts"
import { useShellProfile } from "@/features/app-shell/use-shell-profile.ts"
import { FOCUS_RING } from "@workspace/ui/lib/focus-ring"
import { resolveProfileImageSrc } from "@/lib/requests.ts"

type Props = {
  onNavigate?: () => void
}

export function NavProfile({ onNavigate }: Props) {
  const { name, image } = useShellProfile()
  const imageSrc = resolveProfileImageSrc(image)

  return (
    <div className="mt-auto flex shrink-0 items-center gap-2 border-t border-sidebar-border px-2 py-2">
      <Avatar size="sm" className="size-6">
        {imageSrc ? <AvatarImage src={imageSrc} alt="" /> : null}
        <AvatarFallback className="text-xs">
          {profileInitials(name)}
        </AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">
        {name}
      </span>
      <Link
        to={SURFACE_PATHS.settings}
        onClick={onNavigate}
        className={`${FOCUS_RING} inline-flex h-7 items-center rounded-md px-2 text-sm text-foreground hover:bg-muted`}
      >
        <Settings className="size-4" aria-hidden="true" />
        <span className="sr-only">{shellCopy.settings}</span>
      </Link>
    </div>
  )
}
