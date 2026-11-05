import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { loadInboxFixture, type MailThread } from "@workspace/domain"

const defaultFixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../fixtures/inbox.json"
)

let cache: { path: string; threads: MailThread[] } | null = null

export function inboxFixturePath(env: NodeJS.ProcessEnv = process.env) {
  const set = env.INBOX_FIXTURE?.trim()
  return set ? set : defaultFixturePath
}

export function loadFixtureThreads(
  env: NodeJS.ProcessEnv = process.env
): MailThread[] {
  const path = inboxFixturePath(env)
  if (cache?.path === path) return cache.threads
  const threads = loadInboxFixture(JSON.parse(readFileSync(path, "utf8")))
  cache = { path, threads }
  return threads
}
