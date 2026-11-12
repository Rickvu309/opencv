import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import {
  type ComponentProps,
  createContext,
  type ReactNode,
  useContext,
} from "react"

type ApprovalState =
  | "approval-requested"
  | "approval-responded"
  | "output-denied"
  | "output-available"

type ToolUIPartApproval =
  | {
      id: string
      approved?: boolean
      reason?: string
    }
  | undefined

type ConfirmationContextValue = {
  approval: ToolUIPartApproval
  state: ApprovalState
}

const ConfirmationContext = createContext<ConfirmationContextValue | null>(null)

const useConfirmation = () => {
  const context = useContext(ConfirmationContext)

  if (!context) {
    throw new Error("Confirmation components must be used within Confirmation")
  }

  return context
}

export type ConfirmationProps = ComponentProps<"div"> & {
  approval?: ToolUIPartApproval
  state: ApprovalState
}

export const Confirmation = ({
  className,
  approval,
  state,
  ...props
}: ConfirmationProps) => {
  if (!approval) {
    return null
  }

  return (
    <ConfirmationContext.Provider value={{ approval, state }}>
      <div className={cn("flex flex-col gap-3", className)} {...props} />
    </ConfirmationContext.Provider>
  )
}

export type ConfirmationRequestProps = {
  children?: ReactNode
}

export const ConfirmationRequest = ({ children }: ConfirmationRequestProps) => {
  const { state } = useConfirmation()

  if (state !== "approval-requested") {
    return null
  }

  return children
}

export type ConfirmationAcceptedProps = {
  children?: ReactNode
}

export const ConfirmationAccepted = ({
  children,
}: ConfirmationAcceptedProps) => {
  const { approval, state } = useConfirmation()

  if (
    !approval?.approved ||
    (state !== "approval-responded" &&
      state !== "output-denied" &&
      state !== "output-available")
  ) {
    return null
  }

  return children
}

export type ConfirmationRejectedProps = {
  children?: ReactNode
}

export const ConfirmationRejected = ({
  children,
}: ConfirmationRejectedProps) => {
  const { approval, state } = useConfirmation()

  if (
    approval?.approved !== false ||
    (state !== "approval-responded" &&
      state !== "output-denied" &&
      state !== "output-available")
  ) {
    return null
  }

  return children
}

export type ConfirmationActionsProps = ComponentProps<"div">

export const ConfirmationActions = ({
  className,
  ...props
}: ConfirmationActionsProps) => {
  const { state } = useConfirmation()

  if (state !== "approval-requested") {
    return null
  }

  return (
    <div
      className={cn("flex items-center justify-end gap-2 self-end", className)}
      {...props}
    />
  )
}

export type ConfirmationActionProps = ComponentProps<typeof Button>

export const ConfirmationAction = ({
  className,
  ...props
}: ConfirmationActionProps) => (
  <Button
    className={cn(
      "relative h-11 px-3 text-sm after:absolute after:inset-[min(0px,calc((100%-44px)/2))] after:content-[''] md:h-8",
      className
    )}
    type="button"
    {...props}
  />
)
