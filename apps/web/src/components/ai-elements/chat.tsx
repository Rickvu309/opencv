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

export const chatColumn = "mx-auto w-full min-w-0 max-w-[760px] max-sm:px-4"

export function Conversation({
  className,
  children,
  ...props
}: ComponentProps<typeof MessageScroller>) {
  return (
    <MessageScrollerProvider autoScroll>
      <MessageScroller className={className} {...props}>
        {children}
      </MessageScroller>
    </MessageScrollerProvider>
  )
}

type ConversationContentProps = ComponentProps<
  typeof MessageScrollerContent
> & {
  viewportClassName?: string
}

export function ConversationContent({
  children,
  className,
  viewportClassName,
  ...props
}: ConversationContentProps) {
  return (
    <MessageScrollerViewport className={viewportClassName}>
      <MessageScrollerContent
        aria-label="Chat"
        className={className}
        {...props}
      >
        {children}
      </MessageScrollerContent>
    </MessageScrollerViewport>
  )
}

export function ConversationScrollButton({
  className,
  ...props
}: ComponentProps<typeof MessageScrollerButton>) {
  return (
    <MessageScrollerButton
      className={cn(
        "motion-reduce:animate-none motion-reduce:transition-none",
        className
      )}
      {...props}
    >
      <span className="sr-only">Jump to latest</span>
    </MessageScrollerButton>
  )
}

export const ConversationItem = MessageScrollerItem

export function Chat({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="chat"
      className={cn("flex min-h-0 flex-1 flex-col", className)}
      {...props}
    />
  )
}

export function ChatLog({
  children,
  className,
  viewportClassName,
  ...props
}: ConversationContentProps) {
  return (
    <Conversation>
      <ConversationContent
        className={className}
        viewportClassName={viewportClassName}
        {...props}
      >
        {children}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  )
}

export const ChatItem = ConversationItem
