import { type UserId } from "@workspace/domain/kernel"
import { sql } from "drizzle-orm"

import { getDb } from "../db/context.js"

export const PHOTO_DOCUMENT_COLUMNS = [
  {
    table: "paper_docs",
    column: "crdt_document",
    source: "paper_docs.crdt_document",
  },
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
  { table: "paper_doc_updates", column: "update", source: "paper_doc_updates" },
  { table: "user", column: "image", source: "user.image" },
] as const

export const RELEASED_PHOTO_SOURCE = "paper_doc_updates.released"

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
  {
    table: "paper_doc_updates",
    column: "touched",
    why: "block ids, not a document",
  },
  {
    table: "paper_doc_updates",
    column: "rebuilt",
    why: "block ids, not a document",
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
  {
    table: "paper_package_candidates",
    column: "seal",
    why: "Word package file ids the package store keeps, not photo references",
  },
  {
    table: "paper_package_versions",
    column: "projection",
    why: "Word page text regions, not photo references",
  },
  {
    table: "paper_package_versions",
    column: "sidecar",
    why: "Word paragraph ids, not photo references",
  },
] as const

export async function dropServerReleasedPhoto(userId: UserId, fileId: string) {
  await getDb().execute(sql`
    update opencv_app.paper_doc_updates as updates
    set released_photo_refs = array_remove(updates.released_photo_refs, ${fileId}::uuid)
    where ${fileId}::uuid = any(updates.released_photo_refs)
      and updates.paper_id in (
        select docs.id
        from opencv_app.paper_docs as docs
        where docs.user_id = ${userId}
      )
      and (
        updates.origin = 'server'
        or exists (
          select 1
          from opencv_app.paper_doc_updates as undone
          where undone.paper_id = updates.paper_id
            and undone.origin = 'revert'
            and undone.edit_id = updates.edit_id
        )
      )
  `)
}

export async function referencedPhotoFileIds(userId: UserId) {
  const result = await getDb().execute<{ file_id: string }>(sql`
    select distinct refs.file_id::text as file_id
    from opencv_app.photo_refs as refs
    where refs.user_id = ${userId}
      and (
        refs.source not like 'paper_doc_updates.released:%'
        or exists (
          select 1
          from opencv_app.paper_doc_updates as dropped
          where dropped.paper_id::text =
              split_part(refs.source, 'paper_doc_updates.released:', 2)
            and dropped.origin <> 'server'
            and refs.file_id = any(dropped.released_photo_refs)
            and not exists (
              select 1
              from opencv_app.paper_doc_updates as undone
              where undone.paper_id = dropped.paper_id
                and undone.origin = 'revert'
                and undone.edit_id = dropped.edit_id
            )
        )
      )
  `)
  return new Set(result.rows.map((row) => row.file_id))
}
