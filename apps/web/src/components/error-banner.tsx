import type { ReactNode } from "react"

import { cn } from "@workspace/ui/lib/utils"

type ErrorBannerProps = {
  children: ReactNode
  variant?: "banner" | "inline"
  className?: string
}

export function ErrorBanner({
  children,
  variant = "banner",
  className,
}: ErrorBannerProps) {
  if (variant === "inline") {
    return (
      <p role="alert" className={cn("text-sm text-destructive", className)}>
        {children}
      </p>
    )
  }

  return (
    <div
      role="alert"
      className={cn(
        "border-b border-destructive/30 bg-destructive/10 px-5 py-2 text-sm text-destructive",
        className
      )}
    >
      {children}
    </div>
  )
}
