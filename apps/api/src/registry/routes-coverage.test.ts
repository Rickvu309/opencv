import { Hono } from "hono"
import { describe, expect, it } from "vitest"

import { routeGaps, type RouteCase } from "../test/routes/route-cases.js"

const caseFor = (method: RouteCase["method"], path: string): RouteCase => ({
  method,
  path,
  arrange: async () => ({}),
  request: () => new Request(`http://localhost${path}`),
})

describe("every route outside the command door and the sign-in library has a route case", () => {
  it("fires on a fixture app with an extra route, and on a case for a route that is gone", () => {
    const app = new Hono()
    app.use("*", async (_c, next) => next())
    app.all("/api/auth/*", (c) => c.text("library"))
    app.post("/api/commands/:name", (c) => c.text("door"))
    app.get("/api/jobs", (c) => c.text("jobs"))
    app.post("/api/jobs/:id/archive", (c) => c.text("extra"))
    app.all("/mcp", (c) => c.text("agent"))
    const cases = [
      caseFor("GET", "/api/jobs"),
      caseFor("POST", "/mcp"),
      caseFor("GET", "/api/gone"),
    ]
    expect(routeGaps(app, cases)).toEqual([
      "POST /api/jobs/:id/archive has no route case. Add one to apps/api/src/test/routes/route-cases.ts",
      "GET /api/gone has a route case but the app serves no such route. Delete the case.",
    ])
    expect(
      routeGaps(app, [
        ...cases.slice(0, 2),
        caseFor("POST", "/api/jobs/:id/archive"),
      ])
    ).toEqual([])
  })
})
