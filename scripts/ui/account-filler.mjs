import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  LIBRARY_READS,
  libraryRequest,
  POOL_TARGET,
  SIGN_IN_GAP_MS,
  entryName,
  libraryFrom,
  nextSeq,
  poolEmail,
  poolPaths,
  readyNames,
  realPoolStore,
} from "./account-pool.mjs"
import { cookiesFromSetCookie, lastSignInCode } from "./stack.mjs"

const CODE_DEADLINE_MS = 15_000
const CODE_PAUSE_MS = 100
const FAILURE_PAUSE_MS = 5_000
const FAILURE_LIMIT = 10

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const say = (line) => console.log(`${new Date().toISOString()} ${line}`)

const readLog = (file) => {
  try {
    return readFileSync(file, "utf8")
  } catch {
    return ""
  }
}

const post = (url, body, headers) =>
  fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  })

const retryAfterMs = (response) => {
  const seconds = Number(
    response.headers.get("x-retry-after") ?? response.headers.get("retry-after")
  )
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 10_000
}

async function signInCode(state, email) {
  const until = Date.now() + CODE_DEADLINE_MS
  for (;;) {
    const code = lastSignInCode(readLog(state.logs.api), email)
    if (code) return code
    if (Date.now() > until) throw new Error(`no sign-in code for ${email}`)
    await pause(CODE_PAUSE_MS)
  }
}

async function createAccount(state, email) {
  const headers = { origin: state.webOrigin }
  const sent = await post(
    `${state.apiOrigin}/api/auth/email-otp/send-verification-otp`,
    { email, type: "sign-in" },
    headers
  )
  if (sent.status !== 200)
    throw new Error(`code request for ${email} failed with ${sent.status}`)
  const otp = await signInCode(state, email)
  for (;;) {
    const signed = await post(
      `${state.apiOrigin}/api/auth/sign-in/email-otp`,
      { email, otp },
      headers
    )
    if (signed.status === 429) {
      const wait = retryAfterMs(signed)
      say(`sign-in limited, next try in ${wait / 1000}s`)
      await pause(wait)
      continue
    }
    if (signed.status !== 200)
      throw new Error(`sign-in for ${email} failed with ${signed.status}`)
    const setCookie = signed.headers.getSetCookie()
    const cookie = setCookie.map((line) => line.split(";")[0]).join("; ")
    const bodies = {}
    for (const [kind, library] of Object.entries(LIBRARY_READS)) {
      const read = await fetch(`${state.apiOrigin}${library.path}`, {
        ...libraryRequest(library, { cookie, ...headers }),
        signal: AbortSignal.timeout(10_000),
      })
      if (read.status !== 200)
        throw new Error(
          `${library.path} for ${email} failed with ${read.status}`
        )
      bodies[kind] = await read.json()
    }
    return {
      email,
      cookies: cookiesFromSetCookie(setCookie, "localhost"),
      library: libraryFrom(bodies),
    }
  }
}

export async function fill(dir, target = POOL_TARGET) {
  const state = JSON.parse(readFileSync(join(dir, "state.json"), "utf8"))
  const store = realPoolStore()
  const paths = poolPaths(dir)
  let seq = nextSeq([...store.list(paths.ready), ...store.list(paths.taken)])
  let lastSignIn = 0
  let failures = 0
  say(`filling ${paths.ready} to ${target} accounts`)
  for (;;) {
    const change = store.nextChange(paths.ready)
    if (readyNames(store, paths).length >= target) {
      await change.within(2_147_483_647)
      change.close()
      continue
    }
    change.close()
    const gap = lastSignIn + SIGN_IN_GAP_MS - Date.now()
    if (gap > 0) await pause(gap)
    lastSignIn = Date.now()
    try {
      const account = await createAccount(state, poolEmail(seq))
      const name = entryName(seq)
      const staged = join(paths.root, `${name}.staged`)
      store.write(staged, JSON.stringify(account, null, 2))
      store.rename(staged, join(paths.ready, name))
      say(`ready ${account.email} ${JSON.stringify(account.library)}`)
      seq += 1
      failures = 0
    } catch (error) {
      failures += 1
      say(`failed (${failures}/${FAILURE_LIMIT}): ${error.message}`)
      if (failures >= FAILURE_LIMIT) process.exit(1)
      seq += 1
      await pause(FAILURE_PAUSE_MS)
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await fill(process.argv[2])
