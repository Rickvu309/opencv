import { afterEach, describe, expect, it, vi } from "vitest"

type RealAuthClient = typeof import("./auth-client.ts")

function sentCredentials(call: unknown[]) {
  const [input, init] = call as [RequestInfo | URL, RequestInit | undefined]
  return (
    init?.credentials ??
    (input instanceof Request ? input.credentials : undefined)
  )
}

describe("authClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("names credentials include as the cookie rule for the api origin", async () => {
    const real = await vi.importActual<RealAuthClient>("./auth-client.ts")

    expect(real.SEND_SESSION_COOKIE_TO_API_ORIGIN).toEqual({
      credentials: "include",
    })
  })

  it("sends the session cookie to the api origin on a session read", async () => {
    const fetchStub = vi.fn(
      async () =>
        new Response("null", {
          status: 200,
          headers: { "content-type": "application/json" },
        })
    )
    vi.stubGlobal("fetch", fetchStub)
    vi.resetModules()
    const { authClient } =
      await vi.importActual<RealAuthClient>("./auth-client.ts")

    await authClient.getSession()

    expect(fetchStub).toHaveBeenCalled()
    for (const call of fetchStub.mock.calls) {
      expect(sentCredentials(call)).toBe("include")
    }
  })
})

it("sign-out immediately aborts pending Coach Stop and releases its task", async () => {
  const real = await vi.importActual<RealAuthClient>("./auth-client.ts")
  const { fulfillCoachStop } = await import("./coach-stop-registry.ts")
  const { CHAT, TASK } = await import("@/test/coach-task-fixture.ts")
  const signals: AbortSignal[] = []
  const target = { kind: "task" as const, chatId: CHAT, taskId: TASK }
  const io = {
    start: async () => ({ taskId: TASK }),
    stop: (_chat: string, _task: string, signal: AbortSignal) => {
      signals.push(signal)
      return new Promise<void>(() => {})
    },
    retryDelay: async () => {},
  }
  const pending = fulfillCoachStop(target, io)
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ success: true }))
  )
  await real.authClient.signOut()
  expect(signals[0]?.aborted).toBe(true)
  expect(await pending).toMatchObject({ ok: false, taskId: TASK })
  const next = fulfillCoachStop(target, { ...io, stop: async () => {} })
  expect(next).not.toBe(pending)
  expect(await next).toEqual({ ok: true, taskId: TASK })
})

it.each([null, "session-other"])(
  "session change to %s aborts old Stop without late retries",
  async (nextSession) => {
    const { fulfillCoachStop } = await import("./coach-stop-registry.ts")
    const { CHAT, TASK } = await import("@/test/coach-task-fixture.ts")
    const real = await vi.importActual<RealAuthClient>("./auth-client.ts")
    const original = {
      session: {
        id: "session-original",
        userId: "original",
        token: "token",
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      user: {
        id: "original",
        email: "original@example.test",
        name: "Original",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }
    const initial = real.authClient.$store.atoms.session.get()
    real.authClient.$store.atoms.session.set({
      ...initial,
      data: original,
      isPending: false,
    })
    let release!: () => void
    let signal: AbortSignal | undefined
    const stop = vi.fn(
      (_chat: string, _task: string, requestSignal: AbortSignal) => {
        signal = requestSignal
        return new Promise<void>((resolve) => {
          release = resolve
        })
      }
    )
    const pending = fulfillCoachStop(
      { kind: "task", chatId: CHAT, taskId: TASK },
      {
        start: async () => ({ taskId: TASK }),
        stop,
        retryDelay: async () => {},
      }
    )
    const current = real.authClient.$store.atoms.session.get()
    real.authClient.$store.atoms.session.set({
      ...current,
      isPending: false,
      data: nextSession
        ? {
            session: {
              id: nextSession,
              userId: "other",
              token: "token",
              expiresAt: new Date(),
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            user: {
              id: "other",
              email: "other@example.test",
              name: "Other",
              emailVerified: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          }
        : null,
    })
    expect(signal?.aborted).toBe(true)
    expect(await pending).toMatchObject({ ok: false })
    release()
    await Promise.resolve()
    expect(stop).toHaveBeenCalledTimes(1)
  }
)
