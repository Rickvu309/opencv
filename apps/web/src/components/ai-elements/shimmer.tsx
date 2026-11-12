import type { ComponentProps } from "react"
import { cn } from "@workspace/ui/lib/utils"
import "./shimmer.css"

export function Shimmer({ className, ...props }: ComponentProps<"span">) {
  return <span className={cn("coach-shimmer", className)} {...props} />
}
