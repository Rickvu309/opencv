import { randomUUID } from "node:crypto"
import { serve } from "@hono/node-server"
import { delegateActorSchema, personActor } from "@workspace/domain/kernel"
import { afterAll, beforeAll, expect, it, vi } from "vitest"
import type { ZodType } from "zod"
import { createApp } from "../app.js"
import {
  agentConnections,
  oauthAccessToken,
  oauthClient,
  oauthRefreshToken,
  user,
} from "../db/schema.js"
import { getDb, insideTransaction, withDatabase } from "../db/context.js"
import * as delegatePolicy from "../registry/delegate-policy.js"
import { idOf } from "../registry/coverage-helpers.test-support.js"
import { registry } from "../registry/registry.js"
import {
  createMigratedTestDb,
  testSessionSecret,
  testWebOrigin,
} from "../test/harness.js"
import { hashAgentToken } from "./oauth.js"

let database: Awaited<ReturnType<typeof createMigratedTestDb>>
let server: ReturnType<typeof serve>
let origin: string
let app: ReturnType<typeof createApp>
const owner = "revoke-every-tool"
const person = personActor(owner)
const scopes = ["connection.status", "job.read", "job.write"]

type Hit = { kind: "check" | "read" | "write"; tx: object | null }
const hits: Hit[] = []
let afterCheck: (() => Promise<void>) | undefined

function txNow() {
  return insideTransaction() ? getDb() : null
}

function resetHits() {
  hits.length = 0
}

function productHits() {
  return hits.filter((hit) => hit.kind !== "check")
}

function assertLiveOrder(name: string) {
  expect(productHits().length, name).toBeGreaterThan(0)
  for (let index = 0; index < hits.length; index += 1) {
    const hit = hits[index]
    if (!hit || hit.kind === "check") continue
    let prior: Hit | undefined
    for (let earlier = index - 1; earlier >= 0; earlier -= 1) {
      const candidate = hits[earlier]
      if (candidate?.kind === "check") {
        prior = candidate
        break
      }
    }
    expect(prior, `${name} live check`).toBeTruthy()
    expect(hit.tx, `${name} same transaction`).toBeTruthy()
    expect(prior?.tx, `${name} same transaction`).toBe(hit.tx)
  }
}

function assertNoProduct(name: string) {
  expect(productHits(), name).toEqual([])
}

function probeActor() {
  return delegateActorSchema.parse({
    type: "delegate",
    userId: owner,
    connectionId: randomUUID(),
    name: "Verifier",
    scopes,
    resources: "jobs",
    reads: "allow",
    writes: "approval",
  })
}

beforeAll(async () => {
  database = await createMigratedTestDb()
  server = serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: (request) => app.fetch(request),
  })
  await new Promise<void>((resolve) => server.once("listening", resolve))
  const address = server.address()
  if (!address || typeof address === "string")
    throw new Error("Missing server port")
  origin = `http://127.0.0.1:${address.port}`
  app = createApp({
    db: database.db,
    authUrl: origin,
    sessionSecret: testSessionSecret,
    webOrigins: [testWebOrigin],
    rateLimitEnabled: false,
    sendCodeLimitEnabled: false,
  })
  await database.db.insert(user).values({
    id: owner,
    name: "Verifier",
    email: "revoke-every-tool@example.com",
  })
  const read = registry.read.bind(registry)
  const execute = registry.execute.bind(registry)
  const check = delegatePolicy.requireLiveDelegate
  vi.spyOn(registry, "read").mockImplementation(async (name, input, actor) => {
    if (actor.type === "delegate") hits.push({ kind: "read", tx: txNow() })
    return read(name, input, actor)
  })
  vi.spyOn(registry, "execute").mockImplementation(async (options) => {
    if (options.actor.type === "delegate")
      hits.push({ kind: "write", tx: txNow() })
    return execute(options)
  })
  vi.spyOn(delegatePolicy, "requireLiveDelegate").mockImplementation(
    async (delegate) => {
      const grant = await check(delegate)
      hits.push({ kind: "check", tx: txNow() })
      await afterCheck?.()
      return grant
    }
  )
}, 30000)

afterAll(async () => {
  vi.restoreAllMocks()
  if (server && "closeAllConnections" in server) server.closeAllConnections()
  if (server)
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    )
  await database?.client.close()
})

const inDb = <T>(fn: () => Promise<T>) => withDatabase(database.db, fn)

async function connection() {
  const id = randomUUID()
  const clientId = randomUUID()
  const code = randomUUID()
  const token = randomUUID()
  const refresh = randomUUID()
  const expiresAt = new Date(Date.now() + 3_600_000)
  await database.db.insert(oauthClient).values({
    id: randomUUID(),
    clientId,
    redirectUris: ["http://127.0.0.1/callback"],
    disabled: false,
  })
  await database.db.insert(agentConnections).values({
    id,
    userId: owner,
    clientId,
    authorizationCodeId: code,
    name: "Verifier",
    audience: `${origin}/mcp`,
    scopes,
    resources: { kind: "jobs" },
    policy: { reads: "allow", writes: "approval" },
    expiresAt,
  })
  await database.db.insert(oauthRefreshToken).values({
    id: randomUUID(),
    token: hashAgentToken(refresh),
    clientId,
    userId: owner,
    authorizationCodeId: code,
    scopes,
    expiresAt,
    createdAt: new Date(),
  })
  await database.db.insert(oauthAccessToken).values({
    id: randomUUID(),
    token: hashAgentToken(token),
    clientId,
    userId: owner,
    authorizationCodeId: code,
    resources: [`${origin}/mcp`],
    scopes,
    expiresAt,
    createdAt: new Date(),
  })
  return { id, token }
}

async function job() {
  const created = await inDb(() =>
    registry.execute({
      name: "job.create",
      input: { title: "Private Job", company: "Example", location: "Hanoi" },
      actor: person,
      idempotencyKey: randomUUID(),
    })
  )
  return idOf(created.output)
}

function pauseNextToolList() {
  let entered!: () => void
  let releaseGate!: () => void
  let restored = false
  let opened = false
  const seen = new Promise<void>((resolve) => {
    entered = resolve
  })
  const gate = new Promise<void>((resolve) => {
    releaseGate = resolve
  })
  const original = registry.tools.bind(registry)
  const restore = () => {
    if (restored) return
    restored = true
    registry.tools = original
  }
  registry.tools = async (actor) => {
    const entries = await original(actor)
    restore()
    entered()
    await gate
    return entries
  }
  return {
    seen,
    release: () => {
      if (opened) return
      opened = true
      releaseGate()
    },
    restore,
  }
}

async function postTool(
  token: string,
  name: string,
  args: Record<string, unknown>
) {
  const response = await fetch(`${origin}/mcp`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "MCP-Protocol-Version": "2026-07-28",
      "Mcp-Method": "tools/call",
      "Mcp-Name": name,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name,
        arguments: args,
        _meta: {
          "io.modelcontextprotocol/protocolVersion": "2026-07-28",
          "io.modelcontextprotocol/clientInfo": {
            name: "Verifier",
            version: "1",
          },
          "io.modelcontextprotocol/clientCapabilities": {},
        },
      },
    }),
  })
  return { status: response.status, text: await response.text() }
}

async function rawTool(
  token: string,
  name: string,
  args: Record<string, unknown>
) {
  const posted = await postTool(token, name, args)
  expect(posted.status).toBe(200)
  const envelope = JSON.parse(
    posted.text.startsWith("data:") ? posted.text.slice(5).trim() : posted.text
  ) as {
    error?: unknown
    result?: { content?: Array<{ text?: string }> }
  }
  expect(envelope.error).toBeUndefined()
  return envelope.result?.content?.[0]?.text ?? ""
}

function wireName(name: string) {
  return name.replaceAll(".", "_")
}

async function delegateTools() {
  const entries = await inDb(() => registry.tools(probeActor()))
  expect(entries.length).toBeGreaterThan(0)
  expect(entries.some((entry) => entry.kind === "query")).toBe(true)
  expect(entries.some((entry) => entry.kind === "command")).toBe(true)
  return [...entries].sort((left, right) =>
    left.kind === right.kind
      ? left.name.localeCompare(right.name)
      : left.kind === "query"
        ? -1
        : 1
  )
}

const revoke = (id: string) =>
  inDb(() =>
    registry.execute({
      name: "connections.revoke",
      input: { connectionId: id },
      actor: person,
      idempotencyKey: randomUUID(),
    })
  )

type Check = {
  check?: string
  format?: string
  minimum?: number
  maximum?: number
  value?: number
  inclusive?: boolean
  pattern?: RegExp
}

type Schema = {
  def: {
    type: string
    shape?: Record<string, Schema>
    checks?: Array<{ _zod?: { def?: Check } }>
    innerType?: Schema
    in?: Schema
    options?: Schema[]
    entries?: Record<string, unknown>
    values?: unknown[]
    element?: Schema
    defaultValue?: unknown
  }
  shape?: Record<string, Schema>
}

function asSchema(input: ZodType) {
  return input as unknown as Schema
}

function checksOf(schema: Schema) {
  return (schema.def.checks ?? []).flatMap((check) =>
    check._zod?.def ? [check._zod.def] : []
  )
}

function stable(value: unknown): string {
  if (value === undefined) return "null"
  if (Array.isArray(value))
    return `[${value.map((item) => stable(item)).join(",")}]`
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable(record[key])}`)
      .join(",")}}`
  }
  return JSON.stringify(value)
}

function normalizeRow(value: unknown) {
  if (typeof value !== "string") return stable(value)
  try {
    return stable(JSON.parse(value) as unknown)
  } catch {
    return stable(value)
  }
}

async function productRows() {
  const listed = await database.client.query<{ table_name: string }>(
    `select table_name
     from information_schema.tables
     where table_schema = 'opencv_app'
       and table_type = 'BASE TABLE'
     order by table_name`
  )
  if (listed.rows.length === 0)
    throw new Error("The product schema has no tables")
  const snap: Record<string, string[]> = {}
  for (const table of listed.rows) {
    const name = table.table_name
    if (!/^[a-z0-9_]+$/.test(name)) throw new Error(`Unexpected table ${name}`)
    const selected = await database.client.query<{ row: unknown }>(
      `select row_to_json(t) as row from opencv_app."${name}" t`
    )
    snap[name] = selected.rows.map((entry) => normalizeRow(entry.row)).sort()
  }
  return snap
}

function fail(path: string, detail: string): never {
  throw new Error(`Cannot build an input at ${path}: ${detail}`)
}

function sampleString(schema: Schema, jobId: string, where: string) {
  const list = checksOf(schema)
  if (list.some((check) => check.format === "uuid")) return jobId
  if (list.some((check) => check.format === "email")) return "agent@example.com"
  if (list.some((check) => check.format === "datetime"))
    return "2026-01-15T00:00:00.000Z"
  const unsupported = list.find(
    (check) =>
      check.check === "string_format" &&
      check.format &&
      check.format !== "regex"
  )
  if (unsupported?.format)
    fail(where, `unsupported string format ${unsupported.format}`)
  const min = list.find((check) => check.check === "min_length")?.minimum ?? 1
  const max = list.find((check) => check.check === "max_length")?.maximum
  const length = Math.max(min, 1)
  if (max !== undefined && length > max) fail(where, "string bounds are empty")
  let value = "x".repeat(length)
  const pattern = list.find((check) => check.format === "regex")?.pattern
  if (pattern instanceof RegExp) {
    const matched = [value, "2026-01-15", "agent@example.com"].find(
      (candidate) => pattern.test(candidate)
    )
    if (!matched) fail(where, "string pattern has no sample")
    value = matched
  }
  return value
}

function sampleNumber(schema: Schema) {
  let value = 0
  for (const check of checksOf(schema)) {
    if (check.check === "greater_than" && typeof check.value === "number") {
      const floor = check.inclusive ? check.value : check.value + 1
      if (value < floor) value = floor
    }
    if (check.check === "less_than" && typeof check.value === "number") {
      const ceiling = check.inclusive ? check.value : check.value - 1
      if (value > ceiling) value = ceiling
    }
  }
  return value
}

function sample(schema: Schema, jobId: string, where: string): unknown {
  const type = schema.def.type
  if (type === "pipe" && schema.def.in)
    return sample(schema.def.in, jobId, where)
  if (type === "optional" && schema.def.innerType)
    return sample(schema.def.innerType, jobId, where)
  if (type === "nullable") return null
  if (type === "default") {
    if (typeof schema.def.defaultValue === "function")
      fail(where, "default is computed")
    return schema.def.defaultValue
  }
  if (type === "object") return sampleObject(schema, jobId, where)
  if (type === "array") return sampleArray(schema, jobId, where)
  if (type === "union") return sampleUnion(schema, jobId, where)
  if (type === "enum") {
    const first = Object.values(schema.def.entries ?? {})[0]
    if (typeof first !== "string") fail(where, "enum has no string option")
    return first
  }
  if (type === "literal") {
    const first = schema.def.values?.[0]
    if (first === undefined) fail(where, "literal has no value")
    return first
  }
  if (type === "string") return sampleString(schema, jobId, where)
  if (type === "boolean") return false
  if (type === "number") return sampleNumber(schema)
  if (type === "null") return null
  fail(where, type)
}

function sampleObject(schema: Schema, jobId: string, where: string) {
  const shape = schema.shape ?? schema.def.shape
  if (!shape) fail(where, "object has no shape")
  const args: Record<string, unknown> = {}
  for (const [key, field] of Object.entries(shape)) {
    if (field.def.type === "optional") continue
    if (
      field.def.type === "nullable" &&
      field.def.innerType?.def.type === "optional"
    )
      continue
    args[key] = sample(field, jobId, `${where}.${key}`)
  }
  return args
}

function sampleArray(schema: Schema, jobId: string, where: string) {
  const element = schema.def.element
  if (!element) fail(where, "array has no element")
  const min =
    checksOf(schema).find((check) => check.check === "min_length")?.minimum ?? 0
  return Array.from({ length: min }, (_item, index) =>
    sample(element, jobId, `${where}[${index}]`)
  )
}

function sampleUnion(schema: Schema, jobId: string, where: string): unknown {
  const options = schema.def.options ?? []
  const errors: string[] = []
  for (const [index, option] of options.entries()) {
    try {
      return sample(option, jobId, `${where}|${index}`)
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "invalid")
    }
  }
  fail(where, errors.join("; ") || "union has no option")
}

function toolArguments(entry: { name: string; input: ZodType }, jobId: string) {
  const args = sample(asSchema(entry.input), jobId, entry.name)
  if (args === null || typeof args !== "object" || Array.isArray(args))
    throw new Error(`${entry.name} input must be an object`)
  const parsed = entry.input.safeParse(args)
  if (!parsed.success)
    throw new Error(`${entry.name} input was rejected by its schema`)
  return args as Record<string, unknown>
}

it("checks the connection before product access in the same transaction", async () => {
  const entries = await delegateTools()
  const jobId = await job()
  resetHits()
  for (const entry of entries) {
    const linked = await connection()
    resetHits()
    await rawTool(
      linked.token,
      wireName(entry.name),
      toolArguments(entry, jobId)
    )
    assertLiveOrder(entry.name)
  }
}, 90_000)

it("keeps product access in the checked transaction when removal starts after the check", async () => {
  const entries = await delegateTools()
  const jobId = await job()
  for (const entry of entries) {
    const linked = await connection()
    let checked = () => {}
    let release = () => {}
    const seen = new Promise<void>((resolve) => {
      checked = resolve
    })
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    afterCheck = async () => {
      checked()
      await gate
    }
    resetHits()
    const pending = rawTool(
      linked.token,
      wireName(entry.name),
      toolArguments(entry, jobId)
    )
    try {
      const reached = await Promise.race([
        seen.then(() => true),
        pending.then(() => false),
      ])
      expect(reached, `${entry.name} live check`).toBe(true)
      assertNoProduct(entry.name)
      const removed = revoke(linked.id)
      release()
      await pending
      await removed
      assertLiveOrder(entry.name)
    } finally {
      afterCheck = undefined
      release()
      await pending
    }
  }
}, 90_000)

it("reaches no product data when the connection is already removed", async () => {
  const entries = await delegateTools()
  const jobId = await job()
  for (const entry of entries) {
    const linked = await connection()
    await revoke(linked.id)
    resetHits()
    const posted = await postTool(
      linked.token,
      wireName(entry.name),
      toolArguments(entry, jobId)
    )
    expect(posted.status, entry.name).toBe(401)
    expect(posted.text, entry.name).toContain("invalid_token")
    assertNoProduct(entry.name)
  }
}, 90_000)

it("refuses every registered delegate tool after the connection is removed", async () => {
  const entries = await delegateTools()
  const jobId = await job()
  for (const entry of entries) {
    const linked = await connection()
    const args = toolArguments(entry, jobId)
    const latch = pauseNextToolList()
    const pending = rawTool(linked.token, wireName(entry.name), args)
    try {
      const listed = await Promise.race([
        latch.seen.then(() => true),
        pending.then(
          () => false,
          () => false
        ),
      ])
      if (!listed) {
        await pending
        throw new Error(`${entry.name} finished before its tool list`)
      }
      await revoke(linked.id)
      const before = await productRows()
      resetHits()
      latch.release()
      const text = await pending
      assertNoProduct(entry.name)
      expect(await productRows(), entry.name).toEqual(before)
      expect(text, entry.name).toContain("no longer active")
      expect(text, entry.name).not.toContain("Private Job")
      expect(text, entry.name).not.toContain("pendingActionId")
    } finally {
      latch.release()
      latch.restore()
    }
  }
}, 90_000)
