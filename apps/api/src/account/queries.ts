import { parsePaperId, parseUserId, type Actor } from "@workspace/domain/kernel"
import { and, desc, eq, ilike, or } from "drizzle-orm"

import { getDb } from "../db/context.js"
import { readDelegateActivity } from "../connections/index.js"
import {
  activity,
  chatMessages,
  chats,
  connections,
  files,
  jobChecklist,
  jobs,
  paperDocs,
} from "../db/schema.js"
import { readExportedParts } from "../coach/chat/index.js"
import { isUndoRow } from "../registry/expectation.js"
import type { Registry } from "../registry/registry.js"
import { zipArchive } from "./export-archive.js"
import { getProfileRow, toProfile } from "./store.js"

const INTEGRATION_GROUPS = [
  {
    id: "enabled",
    label: "Enabled",
    items: [
      { id: "gmail", name: "Gmail", line: "" },
      { id: "google-calendar", name: "Google Calendar", line: "" },
      { id: "outlook", name: "Outlook", line: "" },
    ],
  },
  {
    id: "meetings",
    label: "Meetings",
    items: [
      { id: "zoom", name: "Zoom", line: "Add interview calls" },
      { id: "google-meet", name: "Google Meet", line: "Add interview calls" },
      {
        id: "microsoft-teams",
        name: "Microsoft Teams",
        line: "Add interview calls",
      },
    ],
  },
  {
    id: "files",
    label: "Files",
    items: [
      { id: "google-drive", name: "Google Drive", line: "Import your CV" },
      { id: "onedrive", name: "OneDrive", line: "Import your CV" },
      { id: "dropbox", name: "Dropbox", line: "Import your CV" },
    ],
  },
  {
    id: "notes",
    label: "Notes and design",
    items: [
      { id: "notion", name: "Notion", line: "Import notes" },
      { id: "figma", name: "Figma", line: "Add design work" },
      { id: "canva", name: "Canva", line: "" },
    ],
  },
  {
    id: "profiles",
    label: "Profiles",
    items: [
      { id: "linkedin", name: "LinkedIn", line: "Import experience" },
      { id: "github", name: "GitHub", line: "Add projects" },
      { id: "behance", name: "Behance", line: "" },
    ],
  },
] as const

const CONNECTION_PROVIDER: Record<string, "gmail" | "gcalendar"> = {
  gmail: "gmail",
  "google-calendar": "gcalendar",
}

const BILLING_FREE = {
  price: "$0 a month",
  line: "Limited Coach chats on the basic model.",
} as const

const BILLING_PRO = {
  price: "$9 a month",
  line: "Cancel anytime.",
  benefits: [
    "Unlimited Coach chats",
    "Stronger Coach model",
    "Priority support",
    "Early access to Proof",
  ],
} as const

export async function readActivity(
  userId: string,
  filter: { subjectKind?: string; subjectId?: string },
  registry: Registry
) {
  const filters = [eq(activity.userId, userId)]
  if (filter.subjectKind)
    filters.push(eq(activity.subjectKind, filter.subjectKind))
  if (filter.subjectId) filters.push(eq(activity.subjectId, filter.subjectId))
  const rows = await getDb()
    .select()
    .from(activity)
    .where(and(...filters))
    .orderBy(desc(activity.createdAt))
    .limit(100)
  const blocked = await registry.undoBlockedReasons(
    userId,
    rows.map((row) => ({
      command: row.undoneAt == null ? row.reversalCommand : null,
      input: row.reversalInput,
      expect: row.undoneAt == null ? row.reversalExpect : null,
      source: row.command,
    }))
  )
  const receipts = rows.map((row, index) => ({
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    actor: row.actor,
    command: row.command,
    subjectKind: row.subjectKind,
    subjectId: row.subjectId,
    summary: row.summary,
    undoneAt: row.undoneAt?.toISOString() ?? null,
    reversible:
      Boolean(row.reversalCommand) &&
      row.undoneAt == null &&
      !isUndoRow(row) &&
      !blocked[index],
  }))
  const calls = await readDelegateActivity(userId, filter)
  return [...receipts, ...calls]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 100)
}

export async function readProfile(actor: Actor) {
  return toProfile(await getProfileRow(actor.userId))
}

export async function listIntegrations(userId: string) {
  const rows = await getDb()
    .select({
      provider: connections.provider,
      status: connections.status,
    })
    .from(connections)
    .where(eq(connections.userId, userId))
  const active = new Set(
    rows.filter((row) => row.status === "active").map((row) => row.provider)
  )
  return {
    groups: INTEGRATION_GROUPS.map((group) => ({
      id: group.id,
      label: group.label,
      items: group.items.map((item) => ({
        id: item.id,
        name: item.name,
        line: item.line,
        status: integrationStatus(item.id, active),
      })),
    })),
  }
}

function integrationStatus(
  id: string,
  active: Set<"gmail" | "gcalendar">
): "enabled" | "disabled" | "unavailable" {
  const provider = CONNECTION_PROVIDER[id]
  if (!provider) return "unavailable"
  return active.has(provider) ? "enabled" : "disabled"
}

export async function readBilling(userId: string) {
  const profile = toProfile(await getProfileRow(parseUserId(userId)))
  return {
    plan: profile.plan,
    free: BILLING_FREE,
    pro: BILLING_PRO,
    payment: null,
    invoices: [] as [],
  }
}

export const ACCOUNT_EXPORT_INDEX = "opencv-export.json"

export async function exportAccount(userId: string) {
  return (await collectAccountExport(userId)).index
}

export async function exportAccountArchive(userId: string) {
  const { index } = await collectAccountExport(userId)
  return zipArchive([
    {
      path: ACCOUNT_EXPORT_INDEX,
      bytes: Buffer.from(JSON.stringify(index, null, 2)),
      compress: true,
    },
  ])
}

async function collectAccountExport(userId: string) {
  const db = getDb()
  const id = parseUserId(userId)
  const profile = toProfile(await getProfileRow(id))
  const documents = await db
    .select()
    .from(paperDocs)
    .where(eq(paperDocs.userId, userId))
  const fileRows = await db
    .select({
      id: files.id,
      name: files.name,
      mediaType: files.mediaType,
      byteSize: files.byteSize,
      purpose: files.purpose,
      createdAt: files.createdAt,
    })
    .from(files)
    .where(eq(files.userId, userId))
  const jobRows = await db.select().from(jobs).where(eq(jobs.userId, userId))
  const jobIds = jobRows.map((job) => job.id)
  const checklist =
    jobIds.length === 0
      ? []
      : await db
          .select()
          .from(jobChecklist)
          .where(or(...jobIds.map((id) => eq(jobChecklist.jobId, id)))!)
  const feed = await db
    .select()
    .from(activity)
    .where(eq(activity.userId, userId))
    .orderBy(desc(activity.createdAt))
  const chatRows = await db.select().from(chats).where(eq(chats.userId, userId))
  const messages = await db
    .select()
    .from(chatMessages)
    .where(
      chatRows.length
        ? or(...chatRows.map((chat) => eq(chatMessages.chatId, chat.id)))
        : eq(chatMessages.chatId, "00000000-0000-0000-0000-000000000000")
    )
  const connectionRows = await db
    .select({
      id: connections.id,
      provider: connections.provider,
      email: connections.email,
      status: connections.status,
    })
    .from(connections)
    .where(eq(connections.userId, userId))
  return {
    index: {
      profile,
      documents: documents.map(publicDoc),
      files: fileRows.map((file) => ({
        ...file,
        createdAt: file.createdAt.toISOString(),
      })),
      jobs: jobRows.map(publicJob),
      checklist,
      activity: feed.map((row) => ({
        id: row.id,
        actor: row.actor,
        command: row.command,
        subjectKind: row.subjectKind,
        subjectId: row.subjectId,
        summary: row.summary,
        detail: row.detail,
        undoneAt: row.undoneAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
      chats: chatRows.map((chat) => ({
        id: chat.id,
        title: chat.title,
        focusKind: chat.focusKind,
        focusId: chat.focusId,
        createdAt: chat.createdAt.toISOString(),
        updatedAt: chat.updatedAt.toISOString(),
      })),
      messages: messages
        .filter((message) =>
          chatRows.some((chat) => chat.id === message.chatId)
        )
        .map((message) => ({
          id: message.id,
          chatId: message.chatId,
          role: message.role,
          text: message.text,
          parts: readExportedParts(message.parts),
          status: message.status,
          createdAt: message.createdAt.toISOString(),
        })),
      connections: connectionRows,
    },
  }
}

function publicDoc(row: typeof paperDocs.$inferSelect) {
  return {
    id: parsePaperId(row.id),
    name: row.name,
    kind: row.kind,
    templateId: row.templateId,
    paper: null,
    contentVersion: row.contentVersion,
    status: row.status,
    checks: row.checks ?? [],
    pageChoice: row.pageChoice,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function publicJob(row: typeof jobs.$inferSelect) {
  return {
    ...row,
    interviewAt: row.interviewAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function searchWorkspace(actor: Actor, query: string) {
  const pattern = `%${query.replace(/[%_]/g, "")}%`
  const db = getDb()
  const [chatHits, docHits, jobHits] = await Promise.all([
    db
      .select({ id: chats.id, title: chats.title })
      .from(chats)
      .where(and(eq(chats.userId, actor.userId), ilike(chats.title, pattern)))
      .limit(8),
    db
      .select({ id: paperDocs.id, name: paperDocs.name, kind: paperDocs.kind })
      .from(paperDocs)
      .where(
        and(eq(paperDocs.userId, actor.userId), ilike(paperDocs.name, pattern))
      )
      .limit(8),
    db
      .select({
        id: jobs.id,
        title: jobs.title,
        company: jobs.company,
        stage: jobs.stage,
      })
      .from(jobs)
      .where(
        and(
          eq(jobs.userId, actor.userId),
          or(ilike(jobs.title, pattern), ilike(jobs.company, pattern))
        )
      )
      .limit(8),
  ])
  return { chats: chatHits, documents: docHits, jobs: jobHits }
}
