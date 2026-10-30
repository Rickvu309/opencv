import { toast } from "@workspace/ui/components/sonner"

/**
 * A `.catch` handler for a command nobody awaits: it tells the user the
 * server turned the change down, in the server's words when it gave any.
 */
export function reportRejected(action: string) {
  return (error: unknown) => {
    toast(
      error instanceof Error && error.message
        ? error.message
        : `Could not ${action}. Try again.`
    )
  }
}
