import { ChevronsUpDown, LogOut, Settings } from "lucide-react"
import { Link, useNavigate } from "@tanstack/react-router"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"

import { profileInitials } from "@/features/app-shell/profile-display.ts"
import { shellCopy } from "@/features/app-shell/shell-copy.ts"
import { SURFACE_PATHS } from "@/lib/product-paths.ts"
import { useShellProfile } from "@/features/app-shell/use-shell-profile.ts"
import { authClient } from "@/lib/auth-client.ts"
import { resolveProfileImageSrc } from "@/lib/requests.ts"

type Props = {
  onNavigate?: () => void
  onMenuOpenChange?: (open: boolean) => void
}

export function NavProfile({ onNavigate, onMenuOpenChange }: Props) {
  const navigate = useNavigate()
  const { name, email, image } = useShellProfile()
  const imageSrc = resolveProfileImageSrc(image)

  function signOut() {
    onNavigate?.()
    void authClient.signOut().then(() => navigate({ href: "/sign-in" }))
  }

  return (
    <div
      data-slot="shell-profile"
      className="mt-auto shrink-0 border-t border-sidebar-border px-2 py-2 md:border-t-0 md:p-0"
    >
      <DropdownMenu onOpenChange={onMenuOpenChange}>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              data-slot="account-trigger"
              className="h-11 w-full justify-start gap-2 border-0 px-2 hover:bg-sidebar-accent aria-expanded:bg-sidebar-accent md:h-10 md:gap-2"
            />
          }
        >
          <Avatar size="sm">
            {imageSrc ? <AvatarImage src={imageSrc} alt="" /> : null}
            <AvatarFallback className="font-semibold">
              {profileInitials(name)}
            </AvatarFallback>
          </Avatar>
          <span className="flex min-w-0 flex-1 flex-col text-left">
            <span data-slot="account-name" className="truncate">
              {name}
            </span>
            <span data-slot="account-email" className="truncate">
              {email}
            </span>
          </span>
          <ChevronsUpDown
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground"
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" sideOffset={6}>
          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex min-w-0 flex-col gap-0.5 px-2 py-1.5">
              <span className="truncate text-sm font-medium text-foreground">
                {name}
              </span>
              <span className="truncate text-xs font-normal">{email}</span>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            render={<Link to={SURFACE_PATHS.settings} onClick={onNavigate} />}
          >
            <Settings aria-hidden="true" />
            {shellCopy.settings}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={signOut}>
            <LogOut aria-hidden="true" />
            {shellCopy.signOut}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
