import { defineQuery, type Actor } from "@workspace/domain"
import { z } from "zod"
import { and, desc, eq, ilike, or } from "drizzle-orm"

import { getDb } from "../db/context.js"
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
import type { Registry } from "../registry/registry.js"
import { readUsage } from "./usage.js"
import { getProfileRow, toProfile } from "./store.js"

const empty = z.object({}).strict()

export function registerAccountQueries(registry: Registry) {
  registry.addQuery(
    defineQuery({
      name: "profile.get",
      description: "Read the signed-in profile.",
      input: empty,
      coach: true,
      step: () => "Read profile",
      read: (_input, actor) => readProfile(actor),
    })
  )
  registry.addQuery(
    defineQuery({
      name: "coach.usage",
      description: "Read Coach usage for the day, session, and week.",
      input: empty,
      coach: true,
      step: () => "Read usage",
      read: (_input, actor) => readUsage(actor.userId),
    })
  )
  registry.addQuery(
    defineQuery({
      name: "workspace.search",
      description: "Search chats, documents, and jobs.",
      input: z.object({ query: z.string().trim().min(1).max(200) }).strict(),
      coach: true,
      step: () => "Search",
      read: (input, actor) => searchWorkspace(actor, input.query),
    })
  )
}

export async function readProfile(actor: Actor) {
  return toProfile(await getProfileRow(actor.userId))
}

export async function exportAccount(userId: string) {
  const db = getDb()
  const profile = toProfile(await getProfileRow(userId))
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
      .filter((message) => chatRows.some((chat) => chat.id === message.chatId))
      .map((message) => ({
        id: message.id,
        chatId: message.chatId,
        role: message.role,
        text: message.text,
        parts: message.parts,
        status: message.status,
        createdAt: message.createdAt.toISOString(),
      })),
    connections: connectionRows,
  }
}

function publicDoc(row: typeof paperDocs.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    templateId: row.templateId,
    document: row.document,
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

async function searchWorkspace(actor: Actor, query: string) {
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
      .where(and(eq(paperDocs.userId, actor.userId), ilike(paperDocs.name, pattern)))
      .limit(8),
    db
      .select({ id: jobs.id, title: jobs.title, company: jobs.company })
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
