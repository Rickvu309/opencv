import { parseJobId, type Actor, type JobPreview } from "@workspace/domain"

import type { FetchJobPosting } from "./fetch-posting.js"
import { jobWithLink } from "./job-row.js"

type PostingFields = { title: string; company: string; location: string }

export type ReadPosting = (text: string) => Promise<PostingFields | null>

function fieldsInText(text: string): PostingFields {
  const match = text.match(/^(.+?) is hiring an (.+?) in ([^.]+)\./)
  return {
    company: match?.[1]?.trim() ?? "",
    title: match?.[2]?.trim() ?? "",
    location: match?.[3]?.trim() ?? "",
  }
}

async function fieldsFromReader(read: ReadPosting | undefined, text: string) {
  if (!read) return null
  try {
    return await read(text)
  } catch {
    return null
  }
}

function unreadable(message: string): JobPreview {
  return { status: "unreadable", fields: {}, message }
}

export async function previewJob(
  actor: Actor,
  input: { url?: string; text?: string },
  fetchPosting: FetchJobPosting,
  read?: ReadPosting
): Promise<JobPreview> {
  let text = input.text?.trim() ?? ""
  if (!text && input.url) {
    const fetched = await fetchPosting(input.url)
    if (!fetched.ok) return unreadable(fetched.message)
    text = fetched.text
  }
  if (!text) return unreadable("Add a link or some text.")
  const found = fieldsInText(text)
  const better = await fieldsFromReader(read, text)
  const fields = {
    title: better?.title || found.title,
    company: better?.company || found.company,
    location: better?.location || found.location,
  }
  const duplicate = input.url
    ? await jobWithLink(actor.userId, input.url)
    : null
  if (duplicate)
    return {
      status: "duplicate",
      jobId: parseJobId(duplicate.id),
      stage: duplicate.stage,
      fields: {
        title: fields.title || duplicate.title,
        company: fields.company || duplicate.company,
        location: fields.location,
      },
    }
  if (!fields.company) return { status: "company-missing", fields }
  return { status: "filled", fields: { ...fields, description: text } }
}
