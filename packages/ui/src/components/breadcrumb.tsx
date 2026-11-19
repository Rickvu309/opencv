import * as React from "react"
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cn } from "@workspace/ui/lib/utils"
import { ChevronRightIcon, MoreHorizontalIcon } from "lucide-react"

function Breadcrumb({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      aria-label="Breadcrumb"
      data-slot="breadcrumb"
      className={cn("min-w-0", className)}
      {...props}
    />
  )
}

function BreadcrumbList({ className, ...props }: React.ComponentProps<"ol">) {
  return (
    <ol
      data-slot="breadcrumb-list"
      className={cn(
        "flex min-w-0 flex-nowrap items-center gap-2 text-ui leading-4 text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

function BreadcrumbItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="breadcrumb-item"
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 last:min-w-0 last:shrink",
        className
      )}
      {...props}
    />
  )
}

function BreadcrumbLink({
  className,
  render,
  ...props
}: useRender.ComponentProps<"a">) {
  return useRender({
    defaultTagName: "a",
    props: mergeProps<"a">(
      {
        className: cn(
          "touch-manipulation font-normal whitespace-nowrap text-muted-foreground transition-colors [-webkit-tap-highlight-color:transparent] hover:text-foreground active:text-foreground",
          className
        ),
      },
      props
    ),
    render,
    state: {
      slot: "breadcrumb-link",
    },
  })
}

function BreadcrumbPage({
  as: Tag = "span",
  className,
  icon,
  children,
  title,
  ...props
}: Omit<React.ComponentProps<"h1">, "title"> & {
  as?: "span" | "h1"
  icon?: React.ReactNode
  title?: string
}) {
  return (
    <Tag
      data-slot="breadcrumb-page"
      {...(Tag === "span"
        ? { role: "link", "aria-disabled": "true" as const }
        : {})}
      aria-current="page"
      title={title ?? (typeof children === "string" ? children : undefined)}
      className={cn(
        "inline-flex min-w-0 items-center gap-1.5 font-medium text-foreground max-md:min-w-24",
        className
      )}
      {...props}
    >
      {icon ? (
        <span
          aria-hidden="true"
          className="inline-flex shrink-0 items-center [&>svg]:size-3.5"
        >
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 truncate">{children}</span>
    </Tag>
  )
}

function BreadcrumbSeparator({
  children,
  className,
  ...props
}: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center text-muted-foreground [&>svg]:size-[13px]",
        className
      )}
      {...props}
    >
      {children ?? <ChevronRightIcon />}
    </li>
  )
}

function BreadcrumbEllipsis({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="breadcrumb-ellipsis"
      role="presentation"
      aria-hidden="true"
      className={cn(
        "flex size-5 items-center justify-center [&>svg]:size-4",
        className
      )}
      {...props}
    >
      <MoreHorizontalIcon />
      <span className="sr-only">More</span>
    </span>
  )
}

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
}
