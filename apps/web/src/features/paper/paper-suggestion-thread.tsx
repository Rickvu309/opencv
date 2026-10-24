import {
  AssistantMark,
  CommentThread,
  type ThreadMessage,
} from "@workspace/ui/components/comment-thread"

const COACH = { name: "Coach", avatar: <AssistantMark />, assistant: true }
const YOU = { name: "You" }

export type SuggestionThreadMessage = Omit<ThreadMessage, "author">

/** Read-only record of what the Coach changed, loaded when someone asks for it. */
export default function PaperSuggestionThread({
  messages,
}: {
  messages: SuggestionThreadMessage[]
}) {
  return (
    <CommentThread
      title="Coach changes"
      messages={messages.map((message) => ({ ...message, author: COACH }))}
      currentUser={YOU}
      assistant={COACH}
    />
  )
}
