import net from "node:net"
import type { AddressInfo } from "node:net"

import { serve } from "@hono/node-server"
import { Hono } from "hono"
import { afterEach, describe, expect, it } from "vitest"

import {
  createExportGate,
  gatedExport,
  type ExportArchive,
} from "./export-gate.js"

const BUILD_MS = 200

function elapsed(ms: number) {
  return new Promise((done) => setTimeout(done, ms))
}

function archive(): ExportArchive {
  const chunks = [Buffer.alloc(64 * 1024, 1), Buffer.alloc(64 * 1024, 2)]
  return { chunks, byteLength: 128 * 1024 }
}

const servers: Array<ReturnType<typeof serve>> = []

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map(
        (server) => new Promise((done) => server.close(() => done(undefined)))
      )
  )
})

async function listening() {
  const gate = createExportGate()
  const app = new Hono()
  app.get("/export/:owner", (c) =>
    gatedExport(
      gate,
      c.req.param("owner"),
      async () => {
        await elapsed(BUILD_MS)
        return archive()
      },
      60_000,
      c.req.raw.signal
    )
  )
  const server = serve({ fetch: app.fetch, port: 0 })
  servers.push(server)
  await new Promise((done) => server.once("listening", done))
  const { port } = server.address() as AddressInfo
  return { gate, port }
}

function request(port: number, owner: string) {
  const socket = net.connect(port, "127.0.0.1")
  socket.on("error", () => {})
  socket.write(`GET /export/${owner} HTTP/1.1\r\nHost: local\r\n\r\n`)
  return socket
}

describe("export gate over a real connection", () => {
  it("frees the slot when the connection closes while the export is being built", async () => {
    const { gate, port } = await listening()
    const socket = request(port, "ada")
    await elapsed(BUILD_MS / 4)
    expect(gate.running()).toBe(1)
    socket.destroy()
    await elapsed(BUILD_MS * 2)
    expect(gate.running()).toBe(0)
  })

  it("frees the slot when the connection closes before the built export is read", async () => {
    const { gate, port } = await listening()
    const socket = request(port, "ada")
    socket.pause()
    await elapsed(BUILD_MS * 2)
    socket.destroy()
    await elapsed(BUILD_MS)
    expect(gate.running()).toBe(0)
  })

  it("lets two accounts that left during the build make room for everyone else", async () => {
    const { gate, port } = await listening()
    const first = request(port, "ada")
    const second = request(port, "bao")
    await elapsed(BUILD_MS / 4)
    expect(gate.running()).toBe(2)
    first.destroy()
    second.destroy()
    await elapsed(BUILD_MS * 2)
    expect(gate.running()).toBe(0)
    const honest = await fetch(`http://127.0.0.1:${port}/export/chi`)
    expect(honest.status).toBe(200)
    expect((await honest.arrayBuffer()).byteLength).toBe(128 * 1024)
    expect(gate.running()).toBe(0)
  })
})
