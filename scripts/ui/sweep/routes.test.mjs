import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { SCREENS } from "../screens.mjs"
import { routeScreens, staticRoutes, surfacePaths } from "./routes.mjs"

const ROUTER = `
const a = createRoute({ getParentRoute: () => rootRoute, path: "/pricing" })
const b = createRoute({ path: "/blog/$slug" })
const c = createRoute({ path: "/settings/{-$section}" })
const d = createRoute({ path: "$" })
const e = createRoute({ path: "/paper" })
const f = createRoute({ path: "/" })
`
const SURFACES = `
  { id: "paper", path: "/paper", label: "Paper", shown: true, nav: "work" },
  {
    id: "jobs",
    path: "/jobs",
    label: "Jobs",
    shown: false,
  },
  { id: "inbox", path: "/inbox", label: "Inbox", shown: true },
`

test("routes come from the route tree and the shown surfaces, without ids, splats or hidden surfaces", () => {
  assert.deepEqual(surfacePaths(SURFACES), [
    { path: "/paper", shown: true },
    { path: "/jobs", shown: false },
    { path: "/inbox", shown: true },
  ])
  assert.deepEqual(staticRoutes(ROUTER, SURFACES), [
    "/",
    "/inbox",
    "/paper",
    "/pricing",
  ])
})

test("a surface that comes back into the sidebar is swept the moment it is shown", () => {
  const shown = SURFACES.replace("shown: false", "shown: true")
  assert.ok(staticRoutes(ROUTER, shown).includes("/jobs"))
})

test("a route with a reachable recipe is not opened twice; the rest get a plain open", () => {
  const screens = [
    { id: "paper-home", route: "/paper", steps: [] },
    { id: "inbox", route: "/inbox", unreachable: "hidden" },
  ]
  assert.deepEqual(
    routeScreens(["/inbox", "/paper", "/pricing"], screens).map(
      (screen) => screen.id
    ),
    ["route:/inbox", "route:/pricing"]
  )
})

test("the real route tree yields the product routes", () => {
  const read = (path) =>
    readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8")
  const routes = staticRoutes(
    read("apps/web/src/router.tsx"),
    read("apps/web/src/lib/product-paths.ts")
  )
  for (const route of [
    "/",
    "/apply",
    "/coach",
    "/paper",
    "/settings",
    "/sign-in",
  ])
    assert.ok(routes.includes(route), route)
  assert.ok(routeScreens(routes, SCREENS).length > 0)
})
