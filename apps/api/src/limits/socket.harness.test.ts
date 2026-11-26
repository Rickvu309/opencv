import net from "node:net"
import type { AddressInfo } from "node:net"

import { LIMITS } from "@workspace/domain/limits"
import { serve } from "@hono/node-server"
import { Hono } from "hono"
import { afterEach, describe, expect, it, vi } from "vitest"

import { exportDownload } from "../account/index.js"
import { systemClock } from "./clock.js"
import { keyFor } from "./key.js"
import { limited } from "./limited.js"
import { memoryLedger } from "./memory.js"
import type { Ledger } from "./ledger.js"

const BUILD_MS = 200
const spec = LIMITS["export.running"]

function elapsed(ms: number) {
  return new Promise((done) => setTimeout(done, ms))
}

function archive(bytes: number) {
  const chunks = [Buffer.alloc(bytes, 1)]
  return { chunks, byteLength: bytes }
}

function units(ledger: Ledger) {
  return ledger.held().then((held) => held.units)
}

const servers: Array<ReturnType<typeof serve>> = []

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise((done) => {
          const closer = server as { closeAllConnections?: () => void }
          closer.closeAllConnections?.()
          server.close(() => done(undefined))
        })
    )
  )
})

async function listening(bytes: number) {
  const ledger = memoryLedger(spec, systemClock())
  const app = new Hono()
  app.get(
    "/export/:owner",
    limited(
      "export.running",
      (c) => keyFor("account", c.req.param("owner")),
      ledger,
      systemClock()
    ),
    async (c) => {
      await elapsed(BUILD_MS)
      return exportDownload(archive(bytes), c.req.raw.signal)
    }
  )
  const server = serve({ fetch: app.fetch, port: 0 })
  servers.push(server)
  await new Promise((done) => server.once("listening", done))
  const { port } = server.address() as AddressInfo
  return { ledger, port }
}

function request(port: number, owner: string) {
  const socket = net.connect(port, "127.0.0.1")
  socket.on("error", () => {})
  socket.write(
    `GET /export/${owner} HTTP/1.1\r\nHost: local\r\nConnection: close\r\n\r\n`
  )
  return socket
}

async function slots(ledger: Ledger, expected: number, timeout: number) {
  await vi.waitFor(async () => expect(await units(ledger)).toBe(expected), {
    timeout,
    interval: 20,
  })
}

describe("export limit over a real connection", () => {
  it("frees the slot within one second when the connection closes before headers", async () => {
    const { ledger, port } = await listening(64)
    const socket = request(port, "ada")
    await slots(ledger, 1, 1000)
    const started = Date.now()
    socket.destroy()
    await slots(ledger, 0, 1000)
    expect(Date.now() - started).toBeLessThan(1000)
  })

  it("frees the slot when the connection closes before the built export is read", async () => {
    const { ledger, port } = await listening(32 * 1024 * 1024)
    const socket = request(port, "ada")
    socket.pause()
    await slots(ledger, 1, 5000)
    await elapsed(BUILD_MS * 2)
    expect(await units(ledger)).toBe(1)
    socket.destroy()
    await slots(ledger, 0, 1000)
  })

  it("frees the slot after the body has been read and a late close changes nothing", async () => {
    const { ledger, port } = await listening(64)
    const res = await fetch(`http://127.0.0.1:${port}/export/ada`)
    expect(res.status).toBe(200)
    expect((await res.arrayBuffer()).byteLength).toBe(64)
    expect(await units(ledger)).toBe(0)
    const socket = request(port, "bea")
    await slots(ledger, 1, 1000)
    socket.destroy()
    await slots(ledger, 0, 1000)
  })

  it("lets two accounts that left during the build make room for everyone else", async () => {
    const { ledger, port } = await listening(64)
    const first = request(port, "ada")
    const second = request(port, "bao")
    await slots(ledger, 2, 1000)
    first.destroy()
    second.destroy()
    await slots(ledger, 0, 1000)
    const honest = await fetch(`http://127.0.0.1:${port}/export/chi`)
    expect(honest.status).toBe(200)
    expect((await honest.arrayBuffer()).byteLength).toBe(64)
    expect(await units(ledger)).toBe(0)
  })
})
