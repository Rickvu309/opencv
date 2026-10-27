import type { ComponentProps } from "react"

import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@workspace/ui/components/message-scroller"
import { cn } from "@workspace/ui/lib/utils"

export function Chat({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="chat"
      className={cn("flex min-h-0 flex-1 flex-col", className)}
      {...props}
    />
  )
}

type ChatLogProps = ComponentProps<typeof MessageScrollerContent> & {
  viewportClassName?: string
}

export function ChatLog({
  children,
  className,
  viewportClassName,
  ...props
}: ChatLogProps) {
  return (
    <MessageScrollerProvider autoScroll>
      <MessageScroller>
        <MessageScrollerViewport className={viewportClassName}>
          <MessageScrollerContent
            aria-label="Thread"
            className={className}
            {...props}
          >
            {children}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton>
          <span className="sr-only">Jump to latest</span>
        </MessageScrollerButton>
      </MessageScroller>
    </MessageScrollerProvider>
  )
}

export const ChatItem = MessageScrollerItem
