import type { ComponentProps } from "react"

import { Bubble, BubbleContent } from "@workspace/ui/components/bubble"
import {
  Message,
  MessageContent,
  MessageFooter,
} from "@workspace/ui/components/message"
import { cn } from "@workspace/ui/lib/utils"

export { MessageFooter }

export function PersonMessage({
  failed,
  className,
  children,
  ...props
}: ComponentProps<typeof Message> & { failed?: boolean }) {
  return (
    <Message align="end" className={className} {...props}>
      <MessageContent>
        <Bubble
          variant="muted"
          aria-invalid={failed || undefined}
          data-failed={failed ? "true" : undefined}
          className={cn(
            "max-w-[min(85%,28rem)] self-end",
            failed && "*:data-[slot=bubble-content]:border-destructive/40"
          )}
        >
          <BubbleContent className="rounded-[20px] px-4 py-3 text-[15px] leading-[1.5] [overflow-wrap:anywhere] whitespace-pre-wrap text-foreground">
            {children}
          </BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  )
}

export function CoachMessage({
  className,
  children,
  ...props
}: ComponentProps<typeof Message>) {
  return (
    <Message data-ui-message className={cn("w-full", className)} {...props}>
      <MessageContent className="min-w-0 gap-3 text-[15px] leading-6 [overflow-wrap:anywhere]">
        {children}
      </MessageContent>
    </Message>
  )
}
