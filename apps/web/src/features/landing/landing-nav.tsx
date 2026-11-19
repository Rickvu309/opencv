import { documentHref } from "@/lib/web-origins-env.ts"
import { useEffect, useReducer } from "react"
import { Link } from "@tanstack/react-router"
import { Menu, X } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { FOCUS_RING } from "@workspace/ui/lib/focus-ring"
import { cn } from "@workspace/ui/lib/utils"

import { OpenCvLogo } from "@/components/app-logo.tsx"

import { landingButton } from "./landing-button.ts"
import {
  LANDING_CLOSE_MENU_LABEL,
  LANDING_LOGIN_LABEL,
  LANDING_MENU_LABEL,
  LANDING_NAV_LINKS,
  LANDING_PRIMARY_LABEL,
  type LandingNavLink,
} from "./landing-copy.ts"

type NavHref = LandingNavLink["href"]

function pageHref(href: NavHref): Exclude<NavHref, `/#${string}`> | null {
  return href.startsWith("/#")
    ? null
    : (href as Exclude<NavHref, `/#${string}`>)
}

function NavLinks({
  label,
  className,
  onNavigate,
}: {
  label: string
  className: string
  onNavigate?: () => void
}) {
  return (
    <nav aria-label={label} className={className}>
      {LANDING_NAV_LINKS.map((link) => {
        const page = pageHref(link.href)
        return (
          <Link
            key={link.href}
            {...(page ? { to: page } : { to: "/", hash: link.href.slice(2) })}
            onClick={onNavigate}
            className={cn("landing-link", FOCUS_RING)}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}

type MenuAction = { type: "opened" } | { type: "closed" }

function menuReducer(_: boolean, action: MenuAction) {
  return action.type === "opened"
}

function LandingMenu() {
  const [open, dispatch] = useReducer(menuReducer, false)
  const setOpen = (next: boolean) =>
    dispatch({ type: next ? "opened" : "closed" })
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={LANDING_MENU_LABEL}
        className="landing-menu-button size-11"
        onClick={() => setOpen(true)}
      >
        <Menu aria-hidden="true" />
      </Button>
      <DialogContent
        layout="sheet"
        side="end"
        showCloseButton={false}
        className="top-0 right-0 flex h-svh w-[280px] max-w-[80vw] flex-col gap-2 p-2 pt-[calc(env(safe-area-inset-top,0px)+0.5rem)]"
      >
        <div className="flex items-center justify-between ps-3">
          <DialogTitle className="text-sm font-medium">
            {LANDING_MENU_LABEL}
          </DialogTitle>
          <DialogClose
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-11"
                aria-label={LANDING_CLOSE_MENU_LABEL}
              />
            }
          >
            <X aria-hidden="true" />
          </DialogClose>
        </div>
        <NavLinks
          label={LANDING_MENU_LABEL}
          className="landing-menu-links"
          onNavigate={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

export function LandingNav() {
  const [scrolled, scrollChanged] = useReducer(
    (_: boolean, scrolled: boolean) => scrolled,
    false
  )

  useEffect(() => {
    const update = () => scrollChanged(window.scrollY > 8)
    update()
    window.addEventListener("scroll", update, { passive: true })
    return () => window.removeEventListener("scroll", update)
  }, [])

  return (
    <header data-scrolled={scrolled} className="landing-nav">
      <div className="landing-grid">
        <div className="landing-bar landing-inset">
          <Link to="/" className={cn("landing-brand rounded-md", FOCUS_RING)}>
            <OpenCvLogo
              withWordmark
              className="gap-2.25"
              wordmarkClassName="text-[16px] tracking-[-0.5px]"
            />
          </Link>
          <NavLinks label="Primary" className="landing-nav-links" />
          <div className="landing-nav-actions">
            <a
              href={documentHref("/sign-in")}
              className={cn("landing-link", FOCUS_RING)}
            >
              {LANDING_LOGIN_LABEL}
            </a>
            <a
              href={documentHref("/sign-in")}
              className={landingButton({ tone: "primary", size: "nav" })}
            >
              {LANDING_PRIMARY_LABEL}
            </a>
            <LandingMenu />
          </div>
        </div>
      </div>
    </header>
  )
}
