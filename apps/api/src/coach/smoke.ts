/**
 * Live Coach smoke. Never imported by vitest — `pnpm --filter api smoke`.
 * Not wired into CI. Signs up a throwaway User against a Railway API and
 * checks the graceful 503 posture, then (when the key is live) a streamed
 * turn, abort, and a Command receipt.
 *
 *   COACH_SMOKE_API=https://api-staging-f689.up.railway.app pnpm --filter api smoke
 *   COACH_SMOKE_API=https://api-production-0876.up.railway.app \
 *     COACH_SMOKE_MODE=production pnpm --filter api smoke
 */
import { COACH_SSE_EVENTS } from "@workspace/domain"

import { analyzeCoachStream, consumeSseChunk, type SseFrame } from "./smoke-parse.js"

type SmokeMode = "auto" | "posture" | "staging" | "production"

type Json = Record<string, unknown>

const ADVICE_PROMPT =
  "Look at my workspace. Cite the sample CV and the starred Associate PM intern card. What is the one next step?"
const COMMAND_PROMPT =
  "Move my starred Associate PM intern card to Prep. Do not do anything else."

function modeFromEnv(env: NodeJS.ProcessEnv): SmokeMode {
  const raw = env.COACH_SMOKE_MODE?.trim()
  if (
    raw === "posture" ||
    raw === "staging" ||
    raw === "production" ||
    raw === "auto"
  ) {
    return raw
  }
  return "auto"
}

function apiFromEnv(env: NodeJS.ProcessEnv): string {
  const configured = env.COACH_SMOKE_API?.trim()
  if (!configured) {
    throw new Error(
      "COACH_SMOKE_API is required (e.g. https://api-staging-f689.up.railway.app)"
    )
  }
  return configured.replace(/\/$/, "")
}

function smokeUser(env: NodeJS.ProcessEnv) {
  const stamp = Date.now()
  return {
    name: env.COACH_SMOKE_NAME?.trim() || "Coach Smoke",
    email: env.COACH_SMOKE_EMAIL?.trim() || `coach-smoke-${stamp}@openpath.app`,
    password: env.COACH_SMOKE_PASSWORD?.trim() || "correct-horse-battery",
  }
}

function cookieHeader(res: Response) {
  return res.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .filter(Boolean)
    .join("; ")
}

function log(line: string) {
  process.stdout.write(`${line}\n`)
}

async function readJson(res: Response): Promise<Json> {
  return (await res.json()) as Json
}

async function streamFrames(
  res: Response,
  options?: { abortAfterEvents?: number; signal?: AbortSignal }
): Promise<SseFrame[]> {
  if (!res.body) {
    throw new Error("coach stream had no body")
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  const started = Date.now()
  const frames: SseFrame[] = []
  let rest = ""
  let eventCount = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      const atMs = Date.now() - started
      rest += decoder.decode(value ?? new Uint8Array(), { stream: !done })
      const consumed = consumeSseChunk(done ? `${rest}\n\n` : rest, atMs)
      rest = done ? "" : consumed.rest
      for (const frame of consumed.frames) {
        frames.push(frame)
        if (frame.kind === "event") eventCount += 1
      }
      if (
        options?.abortAfterEvents &&
        eventCount >= options.abortAfterEvents
      ) {
        await reader.cancel()
        break
      }
      if (done) break
    }
  } finally {
    reader.releaseLock()
  }

  return frames
}

async function main() {
  const env = process.env
  const api = apiFromEnv(env)
  const mode = modeFromEnv(env)
  const user = smokeUser(env)
  let failed = false

  const fail = (message: string) => {
    failed = true
    log(`FAIL  ${message}`)
  }
  const pass = (message: string) => {
    log(`PASS  ${message}`)
  }

  log(`Coach smoke → ${api} (mode=${mode})`)

  const health = await fetch(`${api}/health`)
  const healthBody = await readJson(health)
  if (health.status === 200 && healthBody.ok === true) {
    pass("GET /health is 200")
  } else {
    fail(`GET /health → ${health.status} ${JSON.stringify(healthBody)}`)
  }

  const unauth = await fetch(`${api}/api/threads/00000000-0000-4000-8000-000000000000/coach`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "smoke" }),
  })
  const unauthBody = await readJson(unauth)
  const unauthCode =
    unauthBody.error && typeof unauthBody.error === "object"
      ? (unauthBody.error as { code?: string }).code
      : undefined

  const healthAfter = await fetch(`${api}/health`)
  if (healthAfter.status === 200) {
    pass("GET /health still 200 after coach probe")
  } else {
    fail(`GET /health after coach probe → ${healthAfter.status}`)
  }

  if (unauth.status === 503 && unauthCode === "COACH_UNAVAILABLE") {
    pass("POST /api/threads/:id/coach is 503 COACH_UNAVAILABLE (key absent)")
    if (mode === "staging" || mode === "production") {
      fail(
        `${mode} mode needs OPENROUTER_API_KEY on this environment; set it and redeploy`
      )
    } else {
      log("SKIP  streamed turn (runtime not wired)")
    }
    process.exitCode = failed ? 1 : 0
    return
  }

  if (unauth.status !== 401) {
    fail(
      `unauthenticated coach → ${unauth.status} ${JSON.stringify(unauthBody)} (expected 401 once the key is live, or 503 without it)`
    )
    process.exitCode = 1
    return
  }

  pass("unauthenticated coach is 401 (runtime is wired)")
  if (mode === "posture") {
    process.exitCode = failed ? 1 : 0
    return
  }

  const origin =
    api.includes("staging")
      ? "https://openpath-git-smoke-rickvudev.vercel.app"
      : "https://openpath-app.vercel.app"

  const signUp = await fetch(`${api}/api/auth/sign-up/email`, {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(user),
  })
  if (signUp.status !== 200) {
    fail(`sign-up → ${signUp.status} ${await signUp.text()}`)
    process.exitCode = 1
    return
  }
  const cookie = cookieHeader(signUp)
  if (!cookie) {
    fail("sign-up did not Set-Cookie")
    process.exitCode = 1
    return
  }
  pass(`signed up ${user.email}`)

  const headers = {
    Origin: origin,
    Cookie: cookie,
    "Content-Type": "application/json",
  }

  const list = await fetch(`${api}/api/threads`, { headers })
  const listBody = (await readJson(list)) as { ok?: boolean; data?: { id: string }[] }
  const threadId = listBody.data?.[0]?.id
  if (list.status !== 200 || !threadId) {
    fail(`list threads → ${list.status} ${JSON.stringify(listBody)}`)
    process.exitCode = 1
    return
  }

  const advice = await fetch(`${api}/api/threads/${threadId}/coach`, {
    method: "POST",
    headers,
    body: JSON.stringify({ text: ADVICE_PROMPT }),
  })
  if (advice.status !== 200) {
    fail(`advice turn → ${advice.status} ${await advice.text()}`)
    process.exitCode = 1
    return
  }
  if (advice.headers.get("x-accel-buffering") !== "no") {
    fail("X-Accel-Buffering is not no")
  } else {
    pass("X-Accel-Buffering: no")
  }
  if (advice.headers.get("content-encoding") === "gzip") {
    fail("coach stream is gzip-compressed")
  }

  const adviceFrames = await streamFrames(advice)
  const adviceAnalysis = analyzeCoachStream(adviceFrames)
  if (adviceAnalysis.messageStartFlushed) {
    pass(
      `message-start flushed in ${adviceAnalysis.firstEventMs ?? "?"}ms`
    )
  } else {
    fail(
      `message-start not flushed promptly (${adviceAnalysis.events[0]} @ ${adviceAnalysis.firstEventMs}ms)`
    )
  }
  if (adviceAnalysis.looksBuffered) {
    fail("advice turn arrived as a late burst (proxy buffering)")
  } else {
    pass("advice turn did not arrive as a single late burst")
  }
  if (adviceAnalysis.text.trim().length === 0) {
    fail("advice turn produced no text")
  } else {
    pass(`advice text (${adviceAnalysis.text.length} chars)`)
  }
  if (adviceAnalysis.heartbeatCount > 0) {
    pass(`${adviceAnalysis.heartbeatCount} heartbeat(s) during the turn`)
  } else {
    log(
      `NOTE  no heartbeats (turn was ${adviceAnalysis.lastEventMs ?? 0}ms; 15s cadence)`
    )
  }

  const abortRes = await fetch(`${api}/api/threads/${threadId}/coach`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      text: "Keep talking about the starred card until I stop you.",
    }),
  })
  if (abortRes.status !== 200) {
    fail(`abort turn → ${abortRes.status} ${await abortRes.text()}`)
  } else {
    await streamFrames(abortRes, { abortAfterEvents: 1 })
    const detail = await fetch(`${api}/api/threads/${threadId}`, { headers })
    const detailBody = (await readJson(detail)) as {
      data?: { messages?: { role?: string; status?: string }[] }
    }
    const lastCoach = [...(detailBody.data?.messages ?? [])]
      .reverse()
      .find((message) => message.role === "coach")
    if (lastCoach?.status === "aborted") {
      pass("aborted turn persisted status=aborted")
    } else {
      fail(
        `abort persist → last coach status=${lastCoach?.status ?? "missing"}`
      )
    }
  }

  if (mode === "production" || mode === "auto" || mode === "staging") {
    const command = await fetch(`${api}/api/threads/${threadId}/coach`, {
      method: "POST",
      headers,
      body: JSON.stringify({ text: COMMAND_PROMPT }),
    })
    if (command.status !== 200) {
      fail(`command turn → ${command.status} ${await command.text()}`)
    } else {
      const commandFrames = await streamFrames(command)
      const commandAnalysis = analyzeCoachStream(commandFrames)
      const moved = commandAnalysis.toolNames.some((name) =>
        name.includes("moveCard")
      )
      if (moved) {
        pass(`command receipt (${commandAnalysis.toolNames.join(", ")})`)
      } else if (commandAnalysis.toolNames.length > 0) {
        pass(
          `command turn ran tools (${commandAnalysis.toolNames.join(", ")})`
        )
      } else {
        fail(
          `command turn had no tool-result (events=${commandAnalysis.events.join(",")})`
        )
      }

      const cards = await fetch(`${api}/api/apply`, { headers })
      const cardsBody = (await readJson(cards)) as {
        data?: { title?: string; starred?: boolean; stage?: string }[]
      }
      const starred = cardsBody.data?.find((card) => card.starred)
      if (moved && starred?.stage === "prep") {
        pass(`starred card is in Prep (${starred.title})`)
      } else if (moved) {
        log(
          `NOTE  tool-result fired; starred card stage=${starred?.stage ?? "?"}`
        )
      }
    }
  }

  if (!adviceAnalysis.events.includes(COACH_SSE_EVENTS.messageEnd) && !failed) {
    log("NOTE  advice stream ended without message-end")
  }

  process.exitCode = failed ? 1 : 0
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exitCode = 1
})
