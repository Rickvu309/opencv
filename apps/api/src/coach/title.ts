import {
  deterministicThreadTitle,
  sanitizeThreadTitle,
  shouldAutoTitleThread,
  THREAD_COMMANDS,
  type CoachRuntime,
  type ThreadMessage,
  type ThreadMessageStatus,
} from "@workspace/domain"

import type { CommandRegistry, AppDatabase } from "../commands/registry.js"
import { getOwnedThread } from "../threads/queries.js"

export const THREAD_TITLE_SYSTEM_PROMPT = [
  "You write History titles for OpenPath Threads.",
  "Write a short title (3 to 8 words) for this first exchange.",
  "Rules:",
  "- Honest: name the topic that was discussed",
  "- Do not claim any action happened",
  "- No exclamation marks, no hype, no emoji",
  "- No quotation marks around the title",
  "- Sentence case",
  "- English",
  "Return only the title.",
].join("\n")

export function threadTitleUserPrompt(userText: string, coachText: string) {
  return `User:\n${userText}\n\nCoach:\n${coachText}`
}

export async function resolveThreadTitle(input: {
  userText: string
  coachText: string
  generateTitle?: CoachRuntime["generateTitle"]
}): Promise<string> {
  if (input.generateTitle) {
    try {
      const generated = sanitizeThreadTitle(
        await input.generateTitle({
          userText: input.userText,
          coachText: input.coachText,
        })
      )
      if (generated) return generated
    } catch {
      // Light-tier title generation is best-effort.
    }
  }

  return deterministicThreadTitle({
    userText: input.userText,
    coachText: input.coachText,
  })
}

/**
 * After the first completed Coach turn, rename a default or first-line
 * Thread through `threads.rename` as the User. Failures are swallowed.
 */
export async function maybeAutoTitleThread(input: {
  db: AppDatabase
  registry: CommandRegistry
  coach: CoachRuntime
  userId: string
  threadId: string
  history: ThreadMessage[]
  coachText: string
  status: ThreadMessageStatus
}): Promise<void> {
  try {
    const thread = await getOwnedThread(input.db, input.userId, input.threadId)
    const eligible = shouldAutoTitleThread({
      currentTitle: thread.title,
      messages: input.history,
      status: input.status,
    })
    if (!eligible) return

    const title = await resolveThreadTitle({
      userText: eligible.userText,
      coachText: input.coachText,
      generateTitle: input.coach.generateTitle?.bind(input.coach),
    })
    if (!title || title === thread.title) return

    await input.registry.execute({
      name: THREAD_COMMANDS.rename,
      input: { threadId: input.threadId, title },
      actor: { type: "user", userId: input.userId },
      db: input.db,
    })
  } catch {
    // Failed title updates must not fail the coach turn.
  }
}
