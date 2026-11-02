import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import type { ComponentProps } from "react"

import { FOCUS_RING } from "@workspace/ui/lib/focus-ring"

const navItemVariants = cva(
  `${FOCUS_RING} flex h-8 items-center gap-2 rounded-md px-2 text-sm font-medium transition-colors duration-(--duration-micro) ease-(--ease-micro) motion-reduce:transition-none [&_svg]:size-4 [&_svg]:shrink-0 [&>span]:truncate`,
  {
    variants: {
      tone: {
        sidebar:
          "text-foreground hover:bg-sidebar-accent aria-[current=page]:bg-sidebar-accent aria-[current=page]:text-sidebar-accent-foreground",
        muted:
          "text-muted-foreground hover:bg-muted hover:text-foreground aria-[current=page]:bg-muted aria-[current=page]:text-foreground",
      },
    },
    defaultVariants: {
      tone: "sidebar",
    },
  }
)

function NavItem({
  className,
  tone = "sidebar",
  active,
  render,
  ...props
}: useRender.ComponentProps<"a"> &
  VariantProps<typeof navItemVariants> & { active?: boolean }) {
  return useRender({
    defaultTagName: "a",
    props: mergeProps<"a">(
      {
        className: cn(navItemVariants({ tone }), className),
        ...(active ? { "aria-current": "page" as const } : {}),
      },
      props
    ),
    render,
    state: {
      slot: "nav-item",
      tone,
    },
  })
}

function NavItemBadge({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      data-slot="nav-item-badge"
      className={cn("ml-auto text-xs tabular-nums", className)}
      {...props}
    />
  )
}

export { NavItem, NavItemBadge }
