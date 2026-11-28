import { type UserId } from "@workspace/domain/kernel"
import { sql } from "drizzle-orm"

import { getDb } from "../db/context.js"

export const PHOTO_DOCUMENT_COLUMNS = [
  {
    table: "activity",
    column: "reversal_input",
    source: "activity.reversal_input",
  },
  { table: "activity", column: "result", source: "activity.result" },
  {
    table: "pending_actions",
    column: "input",
    source: "pending_actions.input",
  },
  { table: "idempotency", column: "result", source: "idempotency.result" },
  { table: "paper_docs", column: "snapshot", source: "paper_docs.snapshot" },
  {
    table: "paper_docs",
    column: "first_page",
    source: "paper_docs.first_page",
  },
  { table: "paper_changes", column: "steps", source: "paper_changes.steps" },
  {
    table: "paper_changes",
    column: "inverse",
    source: "paper_changes.inverse",
  },
  {
    table: "paper_changes",
    column: "commands",
    source: "paper_changes.commands",
  },
] as const

export const PHOTO_BYTE_SOURCES = [
  { table: "user", column: "image", source: "user.image" },
] as const

export const NOT_PHOTO_JSON = [
  {
    table: "pending_actions",
    column: "frozen_review",
    why: "Frozen artifact identity and staged review; Paper owns photo references",
  },
  {
    table: "coach_tasks",
    column: "context_snapshot",
    why: "Coach grounding snapshot, not an authoritative Paper document",
  },
  {
    table: "task_events",
    column: "payload",
    why: "public Coach event, not an authoritative Paper document",
  },
  {
    table: "task_checkpoints",
    column: "model_messages",
    why: "provider protocol replay, not an authoritative Paper document",
  },
  {
    table: "task_checkpoints",
    column: "observed_revisions",
    why: "resource revision stamps, not a document",
  },
  {
    table: "task_checkpoints",
    column: "usage",
    why: "token counters, not a document",
  },
  {
    table: "task_checkpoints",
    column: "request_manifest",
    why: "model options and schemas, not a document",
  },
  {
    table: "tool_intents",
    column: "input",
    why: "Coach invocation replay; Paper and registry own photo references",
  },
  {
    table: "tool_intents",
    column: "observed_revisions",
    why: "resource revision stamps, not a document",
  },
  {
    table: "tool_intents",
    column: "public_result",
    why: "Coach outcome replay; Paper and registry own photo references",
  },
  {
    table: "paper_docs",
    column: "checks",
    why: "check notes do not name a photo",
  },
  { table: "jobs", column: "posting", why: "a job posting, not a CV" },
  {
    table: "inbox_threads",
    column: "draft_times",
    why: "send times, not a document",
  },
  {
    table: "chat_messages",
    column: "parts",
    why: "chat text, not a stored CV",
  },
  {
    table: "activity",
    column: "detail",
    why: "a short note with a name, not a document",
  },
  {
    table: "activity",
    column: "reversal_expect",
    why: "a version stamp, not a document",
  },
  {
    table: "agent_connections",
    column: "policy",
    why: "sign-in client settings for a person's agent, not a document",
  },
  {
    table: "agent_connections",
    column: "resources",
    why: "sign-in client settings for a person's agent, not a document",
  },
  {
    table: "agent_connections",
    column: "scopes",
    why: "sign-in client settings for a person's agent, not a document",
  },
  {
    table: "oauth_access_token",
    column: "confirmation",
    why: "sign-in client settings for a person's agent, not a document",
  },
  {
    table: "oauth_access_token",
    column: "requested_user_info_claims",
    why: "sign-in client settings for a person's agent, not a document",
  },
  {
    table: "oauth_access_token",
    column: "resources",
    why: "sign-in client settings for a person's agent, not a document",
  },
  {
    table: "oauth_access_token",
    column: "scopes",
    why: "sign-in client settings for a person's agent, not a document",
  },
  {
    table: "oauth_client",
    column: "client_credentials_scopes",
    why: "sign-in client settings for a person's agent, not a document",
  },
  {
    table: "oauth_client",
    column: "contacts",
    why: "sign-in client settings for a person's agent, not a document",
  },
  {
    table: "oauth_client",
    column: "grant_types",
    why: "sign-in client settings for a person's agent, not a document",
  },
  {
    table: "oauth_client",
    column: "metadata",
    why: "sign-in client settings for a person's agent, not a document",
  },
  {
    table: "oauth_client",
    column: "post_logout_redirect_uris",
    why: "sign-in client settings for a person's agent, not a document",
  },
  {
    table: "oauth_client",
    column: "redirect_uris",
    why: "sign-in client settings for a person's agent, not a document",
  },
  {
    table: "oauth_client",
    column: "response_types",
    why: "sign-in client settings for a person's agent, not a document",
  },
  {
    table: "oauth_client",
    column: "scopes",
    why: "sign-in client settings for a person's agent, not a document",
  },
  {
    table: "oauth_client_resource",
    column: "metadata",
    why: "sign-in client settings for a person's agent, not a document",
  },
  {
    table: "oauth_consent",
    column: "requested_user_info_claims",
    why: "sign-in client settings for a person's agent, not a document",
  },
  {
    table: "oauth_consent",
    column: "resources",
    why: "sign-in client settings for a person's agent, not a document",
  },
  {
    table: "oauth_consent",
    column: "scopes",
    why: "sign-in client settings for a person's agent, not a document",
  },
  {
    table: "oauth_refresh_token",
    column: "confirmation",
    why: "sign-in client settings for a person's agent, not a document",
  },
  {
    table: "oauth_refresh_token",
    column: "requested_user_info_claims",
    why: "sign-in client settings for a person's agent, not a document",
  },
  {
    table: "oauth_refresh_token",
    column: "resources",
    why: "sign-in client settings for a person's agent, not a document",
  },
  {
    table: "oauth_refresh_token",
    column: "scopes",
    why: "sign-in client settings for a person's agent, not a document",
  },
  {
    table: "oauth_resource",
    column: "allowed_scopes",
    why: "sign-in client settings for a person's agent, not a document",
  },
  {
    table: "oauth_resource",
    column: "custom_claims",
    why: "sign-in client settings for a person's agent, not a document",
  },
  {
    table: "oauth_resource",
    column: "metadata",
    why: "sign-in client settings for a person's agent, not a document",
  },
] as const

export async function referencedPhotoFileIds(userId: UserId) {
  const result = await getDb().execute<{ file_id: string }>(sql`
    select distinct refs.file_id::text as file_id
    from opencv_app.photo_refs as refs
    where refs.user_id = ${userId}
  `)
  return new Set(result.rows.map((row) => row.file_id))
}
