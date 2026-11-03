import { toast } from "@workspace/ui/components/sonner"

export function reportRejected(action: string) {
  return (error: unknown) => {
    toast(
      error instanceof Error && error.message
        ? error.message
        : `Could not ${action}. Try again.`
    )
  }
}
