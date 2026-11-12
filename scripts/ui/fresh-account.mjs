import { readFileSync } from "node:fs"

import { viewportFor } from "./screens.mjs"
import { lastSignInCode } from "./stack.mjs"

const CODE_DEADLINE_MS = 15_000
const CODE_PAUSE_MS = 200
const LIMITED_DEADLINE_MS = 90_000

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export function retryAfterMs(headers) {
  const seconds = Number(headers["x-retry-after"] ?? headers["retry-after"])
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 10_000
}

async function postWithinLimit(context, url, options) {
  const until = Date.now() + LIMITED_DEADLINE_MS
  let response = await context.request.post(url, options)
  while (response.status() === 429 && Date.now() < until) {
    await pause(retryAfterMs(response.headers()))
    response = await context.request.post(url, options)
  }
  return response
}

let opened = 0

export function freshEmail(screenId, nonce) {
  return `ui-recipe+${screenId}-${nonce}@example.com`.toLowerCase()
}

export function recipeNonce(now = Date.now(), count = ++opened) {
  return `${now.toString(36)}${count.toString(36)}`
}

export function contextOptions({ width, scale = 1 }) {
  return {
    viewport: viewportFor(width),
    deviceScaleFactor: scale,
    reducedMotion: "reduce",
  }
}

const readLog = (file) => {
  try {
    return readFileSync(file, "utf8")
  } catch {
    return ""
  }
}

export async function signInFresh(context, state, screenId) {
  const email = freshEmail(screenId, recipeNonce())
  const headers = { origin: state.webOrigin }
  const sent = await context.request.post(
    `${state.apiOrigin}/api/auth/email-otp/send-verification-otp`,
    { data: { email, type: "sign-in" }, headers }
  )
  if (sent.status() !== 200)
    throw new Error(
      `${screenId}: sign-in code request failed with ${sent.status()}`
    )
  const until = Date.now() + CODE_DEADLINE_MS
  let code = lastSignInCode(readLog(state.logs.api), email)
  while (!code && Date.now() < until) {
    await pause(CODE_PAUSE_MS)
    code = lastSignInCode(readLog(state.logs.api), email)
  }
  if (!code)
    throw new Error(`${screenId}: no sign-in code for ${email} in the api log`)
  const signed = await postWithinLimit(
    context,
    `${state.apiOrigin}/api/auth/sign-in/email-otp`,
    { data: { email, otp: code }, headers }
  )
  if (signed.status() !== 200)
    throw new Error(`${screenId}: sign-in failed with ${signed.status()}`)
  return email
}
