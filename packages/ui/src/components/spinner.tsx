import { cn } from "cn"
import { Loader2Icon } from "lucide-react"

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  const decorative =
    props["aria-hidden"] === true || props["aria-hidden"] === "true"
  return (
    <Loader2Icon
      data-slot="spinner"
      role={decorative ? undefined : "status"}
      aria-label={decorative ? undefined : "Loading"}
      className={cn("size-4 motion-safe:animate-spin", className)}
      {...props}
    />
  )
}

export { Spinner }
