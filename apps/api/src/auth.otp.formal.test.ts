import { count, eq } from "drizzle-orm"
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest"

import { createAuthedApp, postJson, sendSignInCode } from "./auth.fixtures.js"
import { session, user, verification } from "./db/schema.js"
import { testAuthUrl } from "./test/harness.js"
import {
  SEED,
  openBackend,
  prng,
  race,
  type Backend,
  type Outcome,
} from "./test/registry-formal-support.js"

const ALLOWED_ATTEMPTS = 3
const CODE_LIFETIME_SECONDS = 300
const CALLERS = [2, 3, 4, 8, 16]
const SEEDS = [SEED, SEED + 1, SEED + 2]

const ROUTES = {
  check: {
    path: "/api/auth/email-otp/check-verification-otp",
    body: (email: string, otp: string) => ({ email, type: "sign-in", otp }),
  },
  signIn: {
    path: "/api/auth/sign-in/email-otp",
    body: (email: string, otp: string) => ({ email, otp }),
  },
} as const

type RouteName = keyof typeof ROUTES

let backend: Backend
let app: ReturnType<typeof createAuthedApp>
let mailbox = 0
const maxEvaluated = new Map<string, number>()

function record(scenario: string, evaluated: number) {
  maxEvaluated.set(
    scenario,
    Math.max(maxEvaluated.get(scenario) ?? 0, evaluated)
  )
}

beforeAll(async () => {
  backend = await openBackend()
  app = createAuthedApp(
    backend.db as unknown as Parameters<typeof createAuthedApp>[0],
    testAuthUrl,
    { logAuthMail: true }
  )
}, 120_000)

afterAll(async () => {
  const rows = [...maxEvaluated].map(
    ([scenario, evaluated]) => `${scenario} max evaluated ${evaluated}`
  )
  console.log(`[formal] backend=${backend.kind}\n${rows.join("\n")}`)
  await backend.close()
})

afterEach(() => {
  vi.useRealTimers()
})

function delaysFor(seed: number, callers: number) {
  const next = prng(seed * 31 + callers)
  return Array.from({ length: callers }, () => Math.floor(next() * 3))
}

function wrongGuesses(code: string, howMany: number, offset = 0) {
  const guesses: string[] = []
  let candidate = Number(code)
  while (guesses.length < howMany + offset) {
    candidate = (candidate + 1) % 1_000_000
    const text = String(candidate).padStart(6, "0")
    if (text !== code) guesses.push(text)
  }
  return guesses.slice(offset)
}

async function issueCode() {
  mailbox += 1
  const email = `formal-${SEED}-${mailbox}-${backend.kind}@example.com`
  await backend.db
    .insert(user)
    .values({ id: `formal-user-${mailbox}-${SEED}`, name: "Ada", email })
  const sent = await sendSignInCode(app, email)
  if (!sent.code) throw new Error("no sign-in code was issued")
  return { email, code: sent.code }
}

function countGuessEvaluations(guesses: string[]) {
  const watched = new Set(guesses)
  const evaluated: string[] = []
  const digest = globalThis.crypto.subtle.digest.bind(globalThis.crypto.subtle)
  const spy = vi
    .spyOn(globalThis.crypto.subtle, "digest")
    .mockImplementation((algorithm, data) => {
      const text = new TextDecoder().decode(data as ArrayBuffer)
      if (watched.has(text)) evaluated.push(text)
      return digest(algorithm, data)
    })
  return { evaluated, stop: () => spy.mockRestore() }
}

async function send(route: RouteName, email: string, otp: string) {
  return postJson(app, ROUTES[route].path, ROUTES[route].body(email, otp))
}

function statusOf(outcome: Outcome<Response>) {
  return outcome.ok ? outcome.value.status : 599
}

async function sessionsOf(email: string) {
  const rows = await backend.db
    .select({ n: count() })
    .from(session)
    .innerJoin(user, eq(user.id, session.userId))
    .where(eq(user.email, email))
  return rows[0]?.n ?? 0
}

describe("A1: at most 3 wrong guesses are evaluated per code", () => {
  for (const route of ["check", "signIn"] as const) {
    it(`${route}: N racing wrong guesses, then sequential probes, evaluate at most 3 and lock the code`, async () => {
      const overBudget: string[] = []
      const takeovers: string[] = []
      for (const callers of CALLERS) {
        for (const seed of SEEDS) {
          const { email, code } = await issueCode()
          const racing = wrongGuesses(code, callers)
          const probes = wrongGuesses(code, 4, callers)
          const counter = countGuessEvaluations([...racing, ...probes])
          const label = `${route} N=${callers} seed=${seed} backend=${backend.kind}`
          try {
            const outcomes = await race(
              racing.map((guess) => () => send(route, email, guess)),
              delaysFor(seed, callers)
            )
            for (const probe of probes) await send(route, email, probe)
            const accepted = outcomes.filter(
              (outcome) => statusOf(outcome) === 200
            )
            expect(accepted, `${label} wrong guess accepted`).toEqual([])
            record(`${route} N=${callers}`, counter.evaluated.length)
            if (counter.evaluated.length > ALLOWED_ATTEMPTS) {
              overBudget.push(`${label} evaluated ${counter.evaluated.length}`)
            }
          } finally {
            counter.stop()
          }
          const takeover = await send(route, email, code)
          if (takeover.status < 400 || (await sessionsOf(email)) > 0) {
            takeovers.push(`${label} the real code still signs in`)
          }
        }
      }
      expect(
        overBudget,
        "runs that evaluated more than 3 wrong guesses"
      ).toEqual([])
      expect(takeovers, "runs where the real code still worked").toEqual([])
    }, 120_000)
  }

  it("guesses split across both routes share one budget of 3", async () => {
    const overBudget: string[] = []
    for (const callers of [4, 8, 16]) {
      for (const seed of SEEDS) {
        const { email, code } = await issueCode()
        const racing = wrongGuesses(code, callers)
        const counter = countGuessEvaluations(racing)
        const label = `both routes N=${callers} seed=${seed} backend=${backend.kind}`
        try {
          await race(
            racing.map(
              (guess, index) => () =>
                send(index % 2 === 0 ? "check" : "signIn", email, guess)
            ),
            delaysFor(seed, callers)
          )
          record(`both-routes N=${callers}`, counter.evaluated.length)
          if (counter.evaluated.length > ALLOWED_ATTEMPTS) {
            overBudget.push(`${label} evaluated ${counter.evaluated.length}`)
          }
        } finally {
          counter.stop()
        }
      }
    }
    expect(overBudget, "runs that evaluated more than 3 wrong guesses").toEqual(
      []
    )
  }, 120_000)

  it("control: three sequential wrong guesses lock the code and a fourth is not evaluated", async () => {
    const { email, code } = await issueCode()
    const guesses = wrongGuesses(code, 4)
    const counter = countGuessEvaluations(guesses)
    try {
      for (const guess of guesses) await send("signIn", email, guess)
    } finally {
      counter.stop()
    }
    expect(counter.evaluated).toEqual(guesses.slice(0, ALLOWED_ATTEMPTS))
    expect((await send("signIn", email, code)).status).toBeGreaterThanOrEqual(
      400
    )
  })
})

describe("A2: a code is accepted at most once", () => {
  it("N racing correct codes on sign-in create one session", async () => {
    for (const callers of CALLERS) {
      for (const seed of SEEDS) {
        const { email, code } = await issueCode()
        const label = `sign-in N=${callers} seed=${seed} backend=${backend.kind}`
        const outcomes = await race(
          Array.from(
            { length: callers },
            () => () => send("signIn", email, code)
          ),
          delaysFor(seed, callers)
        )
        const accepted = outcomes.filter((outcome) => statusOf(outcome) === 200)
        expect(accepted.length, `${label} accepted`).toBe(1)
        expect(await sessionsOf(email), `${label} sessions`).toBe(1)
        expect(
          (await send("signIn", email, code)).status
        ).toBeGreaterThanOrEqual(400)
      }
    }
  }, 120_000)

  it("racing check and sign-in with the correct code create at most one session", async () => {
    for (const callers of [4, 8, 16]) {
      for (const seed of SEEDS) {
        const { email, code } = await issueCode()
        const label = `mixed N=${callers} seed=${seed} backend=${backend.kind}`
        await race(
          Array.from(
            { length: callers },
            (_, index) => () =>
              send(index % 2 === 0 ? "check" : "signIn", email, code)
          ),
          delaysFor(seed, callers)
        )
        expect(
          await sessionsOf(email),
          `${label} sessions`
        ).toBeLessThanOrEqual(1)
      }
    }
  }, 120_000)
})

describe("A3: an expired code is never accepted", () => {
  async function codeAfter(seconds: number) {
    const issued = await issueCode()
    vi.useFakeTimers({ toFake: ["Date"], now: Date.now() + seconds * 1000 })
    return issued
  }

  for (const route of ["check", "signIn"] as const) {
    it(`${route}: N racing correct codes after expiry are all refused`, async () => {
      for (const callers of [1, 4, 16]) {
        const { email, code } = await codeAfter(CODE_LIFETIME_SECONDS + 1)
        const outcomes = await race(
          Array.from({ length: callers }, () => () => send(route, email, code)),
          delaysFor(SEED, callers)
        )
        const statuses = outcomes.map(statusOf)
        expect(statuses.filter((status) => status === 200)).toEqual([])
        expect(await sessionsOf(email)).toBe(0)
        vi.useRealTimers()
      }
    }, 120_000)
  }

  it("control: sign-in accepts the code just before it expires", async () => {
    const { email, code } = await codeAfter(CODE_LIFETIME_SECONDS - 5)
    const res = await send("signIn", email, code)
    expect(res.status).toBe(200)
    expect(await sessionsOf(email)).toBe(1)
  })
})

describe("the harness reaches the real code rows", () => {
  it("a sent code is one hashed verification row for the sign-in identifier", async () => {
    const { email, code } = await issueCode()
    const rows = await backend.db
      .select({ value: verification.value })
      .from(verification)
      .where(eq(verification.identifier, `sign-in-otp-${email}`))
    expect(rows).toHaveLength(1)
    expect(rows[0]?.value).not.toContain(code)
  })
})
