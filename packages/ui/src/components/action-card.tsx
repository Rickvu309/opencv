import type { ComponentProps, ReactNode } from "react"
import { cn } from "cn"

type ActionCardProps = Omit<ComponentProps<"section">, "title"> & {
  icon: ReactNode
  title: ReactNode
  state: ReactNode
  actions?: ReactNode
}

function ActionCard({
  icon,
  title,
  state,
  actions,
  children,
  className,
  ...props
}: ActionCardProps) {
  return (
    <section
      data-slot="action-card"
      className={cn(
        "flex w-full min-w-0 flex-wrap items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 text-card-foreground",
        className
      )}
      {...props}
    >
      <div
        data-slot="action-card-header"
        className="flex min-w-[min(100%,10rem)] flex-1 items-center gap-2.5"
      >
        <span
          aria-hidden="true"
          className="grid size-[26px] shrink-0 place-items-center rounded-sm bg-muted text-muted-foreground [&_svg]:size-[13px]"
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-ui leading-[1.25] font-medium [overflow-wrap:anywhere] text-foreground">
            {title}
          </h3>
          <p className="text-xs leading-4 text-muted-foreground">{state}</p>
        </div>
      </div>
      {children ? (
        <div
          data-slot="action-card-body"
          className="min-w-0 basis-full space-y-2 text-xs text-muted-foreground"
        >
          {children}
        </div>
      ) : null}
      {actions ? (
        <div
          data-slot="action-card-actions"
          className="flex shrink-0 flex-wrap items-center gap-1.5"
        >
          {actions}
        </div>
      ) : null}
    </section>
  )
}

export { ActionCard, type ActionCardProps }
