import { personActor } from "@workspace/domain/kernel"

import { withDatabase } from "../db/context.js"
import { installRegistry } from "../install.js"
import {
  authHeaders,
  createMigratedTestDb,
  createTestApp,
  signUp,
  testWebOrigin,
} from "../test/harness.js"

type TestAppOptions = Parameters<typeof createTestApp>[1]

type Failure = { code: string; message: string; details?: unknown }

export type Reply = {
  status: number
  ok: boolean
  data: unknown
  error: Failure | null
}

export type Person = Awaited<ReturnType<World["person"]>>

export type World = Awaited<ReturnType<typeof openWorld>>

export function dataOf<T>(reply: Reply): T {
  if (!reply.ok)
    throw new Error(
      `expected success, got ${reply.status} ${reply.error?.code}: ${reply.error?.message}`
    )
  return reply.data as T
}

export function failureOf(reply: Reply): Failure {
  if (reply.ok || !reply.error)
    throw new Error(`expected a refusal, got ${reply.status}`)
  return reply.error
}

export async function openWorld(options?: TestAppOptions) {
  const { db, client } = await createMigratedTestDb()
  const app = createTestApp(db, options)
  const registry = installRegistry()
  let people = 0

  async function person(name: string) {
    people += 1
    const { cookie } = await signUp(app, {
      name,
      email: `${name.toLowerCase()}-${people}@scenario.example.com`,
    })
    const headers = authHeaders(cookie)

    async function call(path: string, init: RequestInit): Promise<Reply> {
      const res = await app.request(path, { headers, ...init })
      const body = (await res.json()) as {
        ok: boolean
        data?: unknown
        error?: Failure
      }
      return {
        status: res.status,
        ok: body.ok,
        data: body.data,
        error: body.error ?? null,
      }
    }

    const post = (path: string, body: unknown) =>
      call(path, { method: "POST", body: JSON.stringify(body) })

    const session = (await (
      await app.request("/api/session", { headers })
    ).json()) as { user: { id: string } }
    const actor = personActor(session.user.id)

    return {
      id: session.user.id,
      run: (name: string, input: unknown, idempotencyKey?: string) =>
        post(`/api/commands/${name}`, {
          input,
          ...(idempotencyKey ? { idempotencyKey } : {}),
        }),
      read: (name: string, input: unknown) => post(`/api/reads/${name}`, input),
      undo: (activityId: string) =>
        post("/api/commands/activity.undo", { input: { activityId } }),
      ask: <T>(name: string, input: unknown) =>
        withDatabase(db, () => registry.read(name, input, actor)) as Promise<T>,
      get: (path: string, extra: Record<string, string> = {}) =>
        call(path, { method: "GET", headers: { ...headers, ...extra } }),
      post,
      upload: (path: string, body: FormData, idempotencyKey?: string) => {
        const uploadHeaders = new Headers(headers)
        uploadHeaders.delete("content-type")
        if (idempotencyKey) uploadHeaders.set("idempotency-key", idempotencyKey)
        return call(path, { method: "POST", headers: uploadHeaders, body })
      },
      stream: async (path: string, body: unknown) =>
        (
          await app.request(path, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
          })
        ).text(),
    }
  }

  function visitor() {
    return {
      get: async (path: string): Promise<Reply> => {
        const res = await app.request(path, {
          headers: { Origin: testWebOrigin },
        })
        const body = (await res.json()) as {
          ok: boolean
          data?: unknown
          error?: Failure
        }
        return {
          status: res.status,
          ok: body.ok,
          data: body.data,
          error: body.error ?? null,
        }
      },
      post: (path: string, body: unknown) =>
        app.request(path, {
          method: "POST",
          headers: {
            Origin: testWebOrigin,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }),
      ask: (name: string, input: unknown) =>
        withDatabase(db, () => registry.readAsVisitor(name, input)),
    }
  }

  return {
    person,
    visitor,
    db,
    registry,
    inside: <T>(work: () => Promise<T>) => withDatabase(db, work),
    close: () => client.close(),
  }
}
