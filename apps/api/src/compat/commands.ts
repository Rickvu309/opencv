// Temporary compat for the current web.
// #376 removed the apply map. #377 deletes the thread map, #378 the paper map, and #375 the profile map.
import {
  ERROR_CODES,
  PAPER_COMMANDS,
  PROFILE_COMMANDS,
  THREAD_COMMANDS,
  type Actor,
  type JobStage,
  type PaperDoc,
  type ThreadDetail,
  type ThreadListItem,
  type ThreadMessage,
  type UserProfile,
} from "@workspace/domain"

import { CommandError } from "../registry/errors.js"
import type { ExecuteResult, Registry } from "../registry/registry.js"

const COMPAT_COMMANDS = new Set<string>([
  THREAD_COMMANDS.create,
  THREAD_COMMANDS.rename,
  THREAD_COMMANDS.delete,
  THREAD_COMMANDS.postMessage,
  PAPER_COMMANDS.createDoc,
  PAPER_COMMANDS.updateContent,
  PAPER_COMMANDS.renameDoc,
  PAPER_COMMANDS.setStatus,
  PAPER_COMMANDS.deleteDoc,
  PAPER_COMMANDS.linkApplyCard,
  PROFILE_COMMANDS.setCoachMode,
])

type ChatView = {
  id: string
  title: string
  focusKind: string | null
  focusId: string | null
  createdAt: string
  updatedAt: string
  messages?: MessageView[]
}

type MessageView = {
  id: string
  role: "person" | "coach"
  text: string
  createdAt: string
  parts?: ThreadMessage["parts"]
  status?: ThreadMessage["status"]
  workedMs?: number | null
}

type PaperView = {
  id: string
  name: string
  kind: PaperDoc["kind"]
  status: PaperDoc["status"]
  document: unknown
  contentVersion: number
  createdAt: string
  updatedAt: string
}

type JobView = {
  id: string
  title: string
  company: string
  stage: JobStage
  position: string
  starred: boolean
  jobUrl: string | null
  description: string | null
  interviewAt: string | null
  deadline: string | null
  cvDocId: string | null
  letterDocId: string | null
  createdAt: string
  updatedAt: string
  note?: string
}

export function isCompatCommand(name: string) {
  return COMPAT_COMMANDS.has(name)
}

function outputOf(result: ExecuteResult): unknown {
  return result.output
}

async function run(
  registry: Registry,
  name: string,
  input: unknown,
  actor: Actor
): Promise<unknown> {
  const result = await registry.execute({ name, input, actor })
  return outputOf(result)
}

function asThread(chat: ChatView): ThreadListItem {
  return {
    id: chat.id,
    title: chat.title,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
    focusDocId: chat.focusKind === "paper" ? chat.focusId : null,
  }
}

function asMessage(message: MessageView): ThreadMessage {
  return {
    id: message.id,
    role: message.role === "person" ? "user" : "coach",
    text: message.text,
    createdAt: message.createdAt,
    ...(message.parts ? { parts: message.parts } : {}),
    ...(message.status ? { status: message.status } : {}),
    ...(message.workedMs != null ? { workedMs: message.workedMs } : {}),
  }
}

function asDetail(chat: ChatView): ThreadDetail {
  return {
    ...asThread(chat),
    messages: (chat.messages ?? []).map(asMessage),
  }
}

function asProfile(
  profile: UserProfile & Record<string, unknown>
): UserProfile {
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    emailVerified: profile.emailVerified,
    image: profile.image,
    coachMode: profile.coachMode,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  }
}

async function jobsOf(registry: Registry, actor: Actor) {
  return (await registry.read("job.list", {}, actor)) as JobView[]
}

function asPaper(doc: PaperView, jobs: JobView[]): PaperDoc {
  const linked = jobs.find(
    (job) => job.cvDocId === doc.id || job.letterDocId === doc.id
  )
  return {
    id: doc.id,
    name: doc.name,
    kind: doc.kind,
    status: doc.status,
    content: doc.document,
    contentVersion: doc.contentVersion,
    applyCardId: linked?.id ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

async function paperById(registry: Registry, actor: Actor, docId: string) {
  const doc = (await registry.read("paper.get", { docId }, actor)) as PaperView
  const jobs = await jobsOf(registry, actor)
  return asPaper(doc, jobs)
}

function record(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new CommandError(
      ERROR_CODES.VALIDATION_ERROR,
      "Invalid command input"
    )
  }
  return input as Record<string, unknown>
}

export async function runCompatCommand(
  registry: Registry,
  name: string,
  input: unknown,
  actor: Actor
) {
  const body = record(input)
  switch (name) {
    case THREAD_COMMANDS.create: {
      const title = typeof body.title === "string" ? body.title : undefined
      const focusDocId =
        typeof body.focusDocId === "string" ? body.focusDocId : undefined
      const chat = focusDocId
        ? ((await run(
            registry,
            "chat.open",
            {
              focus: { kind: "paper", id: focusDocId },
            },
            actor
          )) as ChatView)
        : ((await run(
            registry,
            "chat.create",
            title ? { title } : {},
            actor
          )) as ChatView)
      if (focusDocId && title) {
        return asThread(
          (await run(
            registry,
            "chat.rename",
            { chatId: chat.id, title },
            actor
          )) as ChatView
        )
      }
      return asThread(chat)
    }
    case THREAD_COMMANDS.rename: {
      const chat = (await run(
        registry,
        "chat.rename",
        { chatId: body.threadId, title: body.title },
        actor
      )) as ChatView
      return asThread(chat)
    }
    case THREAD_COMMANDS.delete: {
      return run(registry, "chat.delete", { chatId: body.threadId }, actor)
    }
    case THREAD_COMMANDS.postMessage: {
      const chat = (await run(
        registry,
        "chat.appendMessage",
        { chatId: body.threadId, text: body.text },
        actor
      )) as ChatView
      return asDetail(chat)
    }
    case PAPER_COMMANDS.createDoc: {
      if (body.kind === "proof") {
        throw new CommandError(
          ERROR_CODES.VALIDATION_ERROR,
          "Proof is not a document kind."
        )
      }
      const created = (await run(
        registry,
        "paper.create",
        {
          kind: body.kind,
          ...(typeof body.name === "string" ? { name: body.name } : {}),
        },
        actor
      )) as PaperView
      if (body.content !== undefined) {
        await run(
          registry,
          "paper.replace",
          {
            docId: created.id,
            contentVersion: created.contentVersion,
            document: body.content,
          },
          actor
        )
      }
      return paperById(registry, actor, created.id)
    }
    case PAPER_COMMANDS.updateContent: {
      await run(
        registry,
        "paper.replace",
        {
          docId: body.docId,
          contentVersion: body.contentVersion,
          document: body.content,
        },
        actor
      )
      return paperById(registry, actor, String(body.docId))
    }
    case PAPER_COMMANDS.renameDoc: {
      await run(
        registry,
        "paper.rename",
        { docId: body.docId, name: body.name },
        actor
      )
      return paperById(registry, actor, String(body.docId))
    }
    case PAPER_COMMANDS.setStatus: {
      await run(
        registry,
        "paper.setStatus",
        { docId: body.docId, status: body.status },
        actor
      )
      return paperById(registry, actor, String(body.docId))
    }
    case PAPER_COMMANDS.deleteDoc: {
      return run(registry, "paper.delete", { docId: body.docId }, actor)
    }
    case PAPER_COMMANDS.linkApplyCard: {
      const docId = String(body.docId)
      const doc = (await registry.read(
        "paper.get",
        { docId },
        actor
      )) as PaperView
      const jobs = await jobsOf(registry, actor)
      if (body.applyCardId == null) {
        for (const job of jobs) {
          if (job.cvDocId === docId) {
            await run(
              registry,
              "job.unlinkPaper",
              { jobId: job.id, kind: "cv" },
              actor
            )
          }
          if (job.letterDocId === docId) {
            await run(
              registry,
              "job.unlinkPaper",
              { jobId: job.id, kind: "letter" },
              actor
            )
          }
        }
      } else if (doc.kind === "cv" || doc.kind === "letter") {
        await run(
          registry,
          "job.linkPaper",
          { jobId: body.applyCardId, docId, kind: doc.kind },
          actor
        )
      }
      return paperById(registry, actor, docId)
    }
    case PROFILE_COMMANDS.setCoachMode: {
      const profile = (await run(
        registry,
        "profile.update",
        { coachMode: body.mode },
        actor
      )) as UserProfile
      return asProfile(profile)
    }
    default:
      throw new CommandError(ERROR_CODES.UNKNOWN_COMMAND, "Unknown command")
  }
}

export async function listCompatThreads(registry: Registry, actor: Actor) {
  const chats = (await registry.read("chat.list", {}, actor)) as ChatView[]
  return chats.map(asThread)
}

export async function compatThreadByFocus(
  registry: Registry,
  actor: Actor,
  focusDocId: string
) {
  const chats = (await registry.read("chat.list", {}, actor)) as ChatView[]
  const match = chats.find(
    (chat) => chat.focusKind === "paper" && chat.focusId === focusDocId
  )
  return match ? asThread(match) : null
}

export async function compatThreadDetail(
  registry: Registry,
  actor: Actor,
  chatId: string
) {
  const chat = (await registry.read("chat.get", { chatId }, actor)) as ChatView
  return asDetail(chat)
}

export async function listCompatPaper(registry: Registry, actor: Actor) {
  const docs = (await registry.read("paper.list", {}, actor)) as PaperView[]
  const jobs = await jobsOf(registry, actor)
  return docs.map((doc) => asPaper(doc, jobs))
}

export { asDetail, asMessage, asThread }
