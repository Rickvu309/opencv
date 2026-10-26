import {
  cloneElement,
  isValidElement,
  useId,
  type ReactElement,
  type ReactNode,
} from "react"
import { cn } from "cn"

import { Label } from "./label"

type ControlProps = {
  id?: string
  "aria-describedby"?: string
  "aria-invalid"?: boolean
}

function Field({
  label,
  helper,
  error,
  children,
  className,
}: {
  label: string
  helper?: string
  error?: string
  children: ReactNode | ((id: string, describedBy?: string) => ReactNode)
  className?: string
}) {
  const id = useId()
  const messageId = `${id}-msg`
  const describedBy = helper || error ? messageId : undefined
  const control =
    typeof children === "function"
      ? children(id, describedBy)
      : isValidElement<ControlProps>(children)
        ? cloneElement(children as ReactElement<ControlProps>, {
            id,
            "aria-describedby": describedBy,
            "aria-invalid": error ? true : undefined,
          })
        : children

  return (
    <div data-slot="field" className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {control}
      {error ? (
        <p id={messageId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : helper ? (
        <p id={messageId} className="text-sm text-muted-foreground">
          {helper}
        </p>
      ) : null}
    </div>
  )
}

export { Field }
