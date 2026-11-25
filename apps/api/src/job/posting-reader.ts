import { catalog, type Actor, type Plan } from "@workspace/domain"

import type { Registry } from "../registry/registry.js"
import { fetchJobPosting, type FetchJobPosting } from "./fetch-posting.js"
import { previewJob } from "./preview.js"

type ReadPostingOnPlan = (input: {
  plan: Plan
  text: string
}) => Promise<{ title: string; company: string; location: string } | null>

export type JobPreviewOptions = {
  fetch?: FetchJobPosting
  interpret?: ReadPostingOnPlan | null
}

const posting: {
  fetch: FetchJobPosting
  read: ReadPostingOnPlan | null
} = { fetch: fetchJobPosting, read: null }

function planOf(profile: unknown): Plan | null {
  if (!profile || typeof profile !== "object" || !("plan" in profile))
    return null
  return profile.plan === "free" || profile.plan === "pro" ? profile.plan : null
}

export function previewPosting(
  actor: Actor,
  input: { url?: string; text?: string },
  registry: Registry
) {
  return previewJob(
    actor,
    input,
    posting.fetch,
    posting.read
      ? async (text) => {
          const plan = planOf(
            await registry.read(catalog["profile.get"].name, {}, actor)
          )
          return plan && posting.read ? posting.read({ plan, text }) : null
        }
      : undefined
  )
}

export function setPostingReader(options?: JobPreviewOptions) {
  if (options?.fetch) posting.fetch = options.fetch
  if (options && "interpret" in options)
    posting.read = options.interpret ?? null
}
