import {
  cloneElement,
  createContext,
  useContext,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from "react"
import { useRender } from "@base-ui/react/use-render"
import { cn } from "cn"
import { ChevronLeftIcon, EllipsisIcon } from "lucide-react"

import { Button } from "./button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip"

type ActionsMode = "inline" | "menu"

const ActionsModeContext = createContext<ActionsMode>("inline")
const TitleActionsContext = createContext(false)

const PHONE_BREADCRUMB =
  "max-md:[&_[data-slot=breadcrumb-item]:not(:last-child)]:hidden max-md:[&_[data-slot=breadcrumb-separator]]:hidden"

function PageHeader({
  title,
  children,
  className,
  ...props
}: Omit<ComponentProps<"header">, "title"> & { title?: ReactNode }) {
  return (
    <header
      data-slot="page-header"
      className={cn(
        "flex h-[52px] shrink-0 items-center gap-2 border-b border-border pr-4 pl-5",
        PHONE_BREADCRUMB,
        className
      )}
      {...props}
    >
      {title === undefined ? null : <PageHeaderTitle>{title}</PageHeaderTitle>}
      {children}
    </header>
  )
}

function PageHeaderTitle({
  as: Tag = "h1",
  className,
  children,
  title,
  ...props
}: Omit<ComponentProps<"h1">, "title"> & {
  as?: "h1" | "div"
  title?: string
}) {
  return (
    <Tag
      data-slot="page-header-title"
      title={title ?? (typeof children === "string" ? children : undefined)}
      className={cn(
        "min-w-0 truncate text-[13px] leading-4 font-medium text-foreground max-md:min-w-24",
        className
      )}
      {...props}
    >
      {children}
    </Tag>
  )
}

function PageHeaderLeading({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="page-header-leading"
      className={cn("-ml-2 flex shrink-0 items-center md:hidden", className)}
      {...props}
    />
  )
}

function PageHeaderBack({
  className,
  children,
  render,
  ...props
}: useRender.ComponentProps<"a">) {
  return useRender({
    defaultTagName: "a",
    props: {
      className: cn(
        "inline-flex h-11 shrink-0 items-center gap-1 rounded-[6px] px-2 text-[13px] font-normal text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
        className
      ),
      children: (
        <>
          <ChevronLeftIcon aria-hidden="true" className="size-[15px]" />
          {children}
        </>
      ),
      ...props,
    },
    render,
    state: { slot: "page-header-back" },
  })
}

function PageHeaderTitleActions({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <TitleActionsContext value>
      <div
        data-slot="page-header-title-actions"
        className={cn("flex shrink-0 items-center gap-2", className)}
        {...props}
      />
    </TitleActionsContext>
  )
}

function PageHeaderMeta({
  icon,
  showOnPhone = false,
  className,
  children,
  ...props
}: ComponentProps<"span"> & { icon?: ReactNode; showOnPhone?: boolean }) {
  return (
    <span
      data-slot="page-header-meta"
      className={cn(
        "mr-1.5 ml-auto inline-flex items-center gap-1.5 text-[12.5px] leading-[15px] whitespace-nowrap text-muted-foreground [&_svg]:size-[15px]",
        !showOnPhone && "max-md:hidden",
        className
      )}
      {...props}
    >
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      {children}
    </span>
  )
}

function PageHeaderActions({
  overflowLabel,
  className,
  children,
  ...props
}: ComponentProps<"div"> & { overflowLabel?: string }) {
  return (
    <div
      data-slot="page-header-actions"
      className={cn(
        "ml-auto flex shrink-0 items-center gap-2 [[data-slot=page-header-meta]+&]:ml-0",
        className
      )}
      {...props}
    >
      <ActionsModeContext value="inline">{children}</ActionsModeContext>
      {overflowLabel ? (
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger
              render={
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      data-slot="page-header-overflow"
                      aria-label={overflowLabel}
                      className="size-7 rounded-[6px] max-md:size-11 md:hidden [&_svg:not([class*='size-'])]:size-[15px]"
                    />
                  }
                />
              }
            >
              <EllipsisIcon aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent>{overflowLabel}</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end">
            <ActionsModeContext value="menu">{children}</ActionsModeContext>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  )
}

function PageHeaderAction({
  label,
  icon,
  onSelect,
  collapse = false,
  showLabel = false,
  pressed,
  disabled,
  render,
  hint,
  className,
}: {
  label: string
  icon: ReactNode
  onSelect?: () => void
  collapse?: boolean
  showLabel?: boolean
  pressed?: boolean
  disabled?: boolean
  render?: ReactElement<{ className?: string; disabled?: boolean }>
  hint?: ReactNode
  className?: string
}) {
  const mode = useContext(ActionsModeContext)
  const inTitle = useContext(TitleActionsContext)

  if (mode === "menu") {
    if (!collapse) return null
    return (
      <DropdownMenuItem
        disabled={disabled}
        onClick={() => onSelect?.()}
        data-slot="page-header-menu-action"
      >
        <span aria-hidden="true" className="inline-flex">
          {icon}
        </span>
        {label}
      </DropdownMenuItem>
    )
  }

  const classes = cn(
    "rounded-[6px] [&_svg:not([class*='size-'])]:size-[15px]",
    showLabel
      ? "h-7 gap-1.5 px-2 text-[13px] font-normal max-md:h-11"
      : cn("max-md:size-11", inTitle ? "size-[26px]" : "size-7"),
    collapse && "max-md:hidden",
    className
  )

  if (showLabel) {
    return (
      <Button
        type="button"
        variant="ghost"
        data-slot="page-header-action"
        className={classes}
        aria-pressed={pressed}
        disabled={disabled}
        onClick={onSelect}
      >
        {icon}
        {label}
      </Button>
    )
  }

  const control = render ? (
    cloneElement(render, {
      className: cn(classes, render.props.className),
      disabled,
    })
  ) : (
    <Button
      type="button"
      variant="ghost"
      data-slot="page-header-action"
      disabled={disabled}
      className={classes}
    />
  )

  return (
    <Tooltip>
      <TooltipTrigger
        render={control}
        aria-label={label}
        aria-pressed={pressed}
        onClick={onSelect}
      >
        {icon}
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {hint}
      </TooltipContent>
    </Tooltip>
  )
}

function PageHeaderPrimary({
  icon,
  className,
  children,
  ...props
}: Omit<ComponentProps<typeof Button>, "variant" | "size"> & {
  icon?: ReactNode
}) {
  const mode = useContext(ActionsModeContext)
  if (mode === "menu") return null
  return (
    <Button
      type="button"
      variant="ghost"
      data-slot="page-header-primary"
      data-primary-action
      className={cn(
        "h-7 gap-1.5 rounded-[6px] px-2 text-[13px] font-normal max-md:h-11",
        className
      )}
      {...props}
    >
      {icon ? (
        <span
          aria-hidden="true"
          className="inline-flex text-muted-foreground [&_svg]:size-3.5! [&_svg]:[stroke-width:2.25]"
        >
          {icon}
        </span>
      ) : null}
      {children}
    </Button>
  )
}

export {
  PageHeader,
  PageHeaderTitle,
  PageHeaderLeading,
  PageHeaderBack,
  PageHeaderTitleActions,
  PageHeaderMeta,
  PageHeaderActions,
  PageHeaderAction,
  PageHeaderPrimary,
}
