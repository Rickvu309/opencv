import { afterEach, describe, it, vi } from "vitest"
import { cleanup, screen } from "@testing-library/react"
import { createMemoryHistory } from "@tanstack/react-router"

import { NotFoundPage } from "@/features/app-shell/not-found-page.tsx"
import { createAppRouter } from "@/router.tsx"
import { setMockSession } from "@/test/auth-client-mock.ts"
import { renderApp } from "@/test/render-app.tsx"

import { ROUTE_TABLE, type RouteClass } from "./route-table.ts"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const ORIGIN = "http://marketing.test"

type LiveRoute = {
  id: string
  fullPath: string
  path: string
  to: string
  component: unknown
}

type RawRoute = {
  id: string
  fullPath: string
  path?: string
  to?: string
  options?: { component?: unknown }
}

type LinkFailure = {
  page: string
  link: string
  href: string
  why: string
}

type Parsed =
  | { kind: "external" }
  | { kind: "internal"; pathname: string; hash: string }
  | { kind: "bad"; why: string }

function makeRouter() {
  return createAppRouter({
    history: createMemoryHistory({ initialEntries: ["/"] }),
  })
}

function canonicalPath(path: string): string {
  if (path.length > 1 && path.endsWith("/")) return path.replace(/\/+$/, "")
  return path.length === 0 ? "/" : path
}

function liveRoutes(router: ReturnType<typeof makeRouter>): LiveRoute[] {
  const byId = router.routesById as unknown as Record<string, RawRoute>
  return Object.values(byId).map((route) => ({
    id: route.id,
    fullPath: route.fullPath,
    path: route.path ?? "",
    to: route.to ?? route.fullPath,
    component: route.options?.component,
  }))
}

function routeMap(router: ReturnType<typeof makeRouter>) {
  return new Map(liveRoutes(router).map((route) => [route.id, route]))
}

function hasParam(route: LiveRoute): boolean {
  return route.fullPath.includes("$") || route.path.includes("$")
}

function leafOf(
  router: ReturnType<typeof makeRouter>,
  routes: Map<string, LiveRoute>,
  pathname: string
): LiveRoute | undefined {
  const matches = router.matchRoutes(pathname) as unknown as {
    routeId: string
  }[]
  const leaf = matches.at(-1)
  if (!leaf) return undefined
  return routes.get(leaf.routeId)
}

function isNotFound(route: LiveRoute | undefined): boolean {
  return route?.component === NotFoundPage
}

function block(lines: string[]): string {
  return lines.join("\n")
}

function classificationProblems(
  router: ReturnType<typeof makeRouter>
): string[] {
  const routes = liveRoutes(router)
  const problems: string[] = []
  const seen = new Set<string>()
  for (const row of ROUTE_TABLE) {
    if (seen.has(row.id)) {
      problems.push(
        block([
          "duplicate route",
          `id: ${row.id}`,
          "why: route-table.ts lists this id more than once",
        ])
      )
    }
    seen.add(row.id)
  }

  const table = new Map<string, RouteClass>(
    ROUTE_TABLE.map((row) => [row.id, row])
  )
  const liveIds = new Set(routes.map((route) => route.id))
  for (const route of routes) {
    const row = table.get(route.id)
    if (!row) {
      problems.push(
        block([
          "unclassified route",
          `id: ${route.id}`,
          `fullPath: ${route.fullPath}`,
          "why: router.tsx has this route and route-table.ts does not list it",
        ])
      )
      continue
    }
    if (row.fullPath !== route.fullPath) {
      problems.push(
        block([
          "table drift",
          `id: ${route.id}`,
          `fullPath: ${route.fullPath}`,
          `why: route-table.ts fullPath is ${row.fullPath} but the router fullPath is ${route.fullPath}`,
        ])
      )
    }
    if (row.kind === "marketing" && hasParam(route) && !row.enumerate) {
      problems.push(
        block([
          "missing enumerator",
          `id: ${route.id}`,
          `fullPath: ${route.fullPath}`,
          "why: this marketing route has a param and route-table.ts does not set enumerate",
        ])
      )
    }
    if (
      row.kind === "marketing" &&
      hasParam(route) &&
      row.enumerate &&
      row.enumerate().length === 0
    ) {
      problems.push(
        block([
          "empty enumerator",
          `id: ${route.id}`,
          `fullPath: ${route.fullPath}`,
          "why: enumerate returned no concrete paths",
        ])
      )
    }
    if (row.kind !== "marketing" && row.enumerate) {
      problems.push(
        block([
          "unexpected enumerator",
          `id: ${route.id}`,
          `why: kind ${row.kind} must not set enumerate`,
        ])
      )
    }
  }
  for (const row of ROUTE_TABLE) {
    if (!liveIds.has(row.id)) {
      problems.push(
        block([
          "stale route",
          `id: ${row.id}`,
          `fullPath: ${row.fullPath}`,
          "why: route-table.ts lists this route and the router does not",
        ])
      )
    }
  }

  const probe = leafOf(router, routeMap(router), "/this-page-is-not-real")
  if (!isNotFound(probe)) {
    problems.push(
      block([
        "not-found probe",
        "path: /this-page-is-not-real",
        `why: the leaf was ${probe?.id ?? "no match"}, not a route whose component is NotFoundPage`,
      ])
    )
  }
  return problems
}

function marketingPaths(router: ReturnType<typeof makeRouter>): string[] {
  const routes = routeMap(router)
  const paths: string[] = []
  for (const row of ROUTE_TABLE) {
    if (row.kind !== "marketing") continue
    const route = routes.get(row.id)
    if (!route) {
      throw new Error(
        block([
          "stale route",
          `id: ${row.id}`,
          `fullPath: ${row.fullPath}`,
          "why: route-table.ts lists this marketing route and the router does not",
        ])
      )
    }
    if (hasParam(route)) {
      if (!row.enumerate) {
        throw new Error(
          block([
            "missing enumerator",
            `id: ${route.id}`,
            `fullPath: ${route.fullPath}`,
            "why: this marketing route has a param and route-table.ts does not set enumerate",
          ])
        )
      }
      const enumerated = row.enumerate()
      if (enumerated.length === 0) {
        throw new Error(
          block([
            "empty enumerator",
            `id: ${route.id}`,
            `fullPath: ${route.fullPath}`,
            "why: enumerate returned no concrete paths",
          ])
        )
      }
      for (const entry of enumerated) {
        if (!entry.startsWith("/") || entry.includes("$")) {
          throw new Error(
            block([
              "bad enumerator path",
              `id: ${route.id}`,
              `path: ${entry}`,
              "why: enumerate must return concrete paths, not a pattern",
            ])
          )
        }
        const path = canonicalPath(entry)
        const leaf = leafOf(router, routes, path)
        if (!leaf || leaf.id !== route.id || isNotFound(leaf)) {
          throw new Error(
            block([
              "bad enumerator path",
              `id: ${route.id}`,
              `path: ${path}`,
              `why: this path matched ${leaf?.id ?? "no route"}, not ${route.id}`,
            ])
          )
        }
        paths.push(path)
      }
      continue
    }
    if (row.enumerate) {
      throw new Error(
        block([
          "unexpected enumerator",
          `id: ${route.id}`,
          "why: this marketing route has no param, so enumerate must be omitted",
        ])
      )
    }
    const path = canonicalPath(route.to)
    const leaf = leafOf(router, routes, path)
    if (!leaf || leaf.id !== route.id || isNotFound(leaf)) {
      throw new Error(
        block([
          "marketing path",
          `id: ${route.id}`,
          `path: ${path}`,
          `why: this path matched ${leaf?.id ?? "no route"} instead of ${route.id}`,
        ])
      )
    }
    paths.push(path)
  }
  return paths
}

function parseHref(href: string, page: string): Parsed {
  let url: URL
  try {
    url = new URL(href, new URL(page, ORIGIN))
  } catch {
    return { kind: "bad", why: `href ${JSON.stringify(href)} is not a URL` }
  }
  if (url.origin !== ORIGIN) return { kind: "external" }
  let hash = ""
  if (url.hash.length > 1) {
    try {
      hash = decodeURIComponent(url.hash.slice(1))
    } catch {
      return {
        kind: "bad",
        why: `hash in ${JSON.stringify(href)} is not valid percent-encoding`,
      }
    }
  }
  return {
    kind: "internal",
    pathname: canonicalPath(url.pathname),
    hash,
  }
}

function formatLink(failure: LinkFailure): string {
  return block([
    `page: ${failure.page}`,
    `link: ${failure.link}`,
    `href: ${failure.href}`,
    `why: ${failure.why}`,
  ])
}

async function readPage(path: string): Promise<{
  links: { text: string; href: string }[]
  ids: Set<string>
}> {
  setMockSession(null)
  const view = renderApp(path)
  try {
    await screen.findByRole("main")
    const actual = canonicalPath(view.router.state.location.pathname)
    if (actual !== canonicalPath(path)) {
      throw new Error(`page ${path} rendered at ${actual}`)
    }
    const links = [...document.querySelectorAll("a[href]")].flatMap((node) => {
      if (!(node instanceof HTMLAnchorElement)) return []
      const href = node.getAttribute("href")
      if (href === null) return []
      const text = node.textContent?.replace(/\s+/g, " ").trim() || "(no text)"
      return [{ text, href }]
    })
    const ids = new Set<string>()
    for (const node of document.querySelectorAll("[id]")) {
      if (node.id) ids.add(node.id)
    }
    if (links.length === 0) {
      throw new Error(`page ${path} rendered no <a href>`)
    }
    return { links, ids }
  } finally {
    cleanup()
  }
}

describe("marketing routes", () => {
  it("classifies every route from createAppRouter", () => {
    const problems = classificationProblems(makeRouter())
    if (problems.length > 0) throw new Error(problems.join("\n\n"))
  })

  it("resolves every internal link and hash on every marketing page", async () => {
    const router = makeRouter()
    const routes = routeMap(router)
    const paths = marketingPaths(router)
    const idsByPath = new Map<string, Set<string>>()
    const found: { page: string; text: string; href: string }[] = []
    for (const path of paths) {
      const read = await readPage(path)
      idsByPath.set(canonicalPath(path), read.ids)
      for (const link of read.links) {
        found.push({ page: path, text: link.text, href: link.href })
      }
    }

    const failures: LinkFailure[] = []
    const seen = new Set<string>()
    const push = (failure: LinkFailure) => {
      const formatted = formatLink(failure)
      if (seen.has(formatted)) return
      seen.add(formatted)
      failures.push(failure)
    }
    const hashes: {
      page: string
      text: string
      href: string
      pathname: string
      hash: string
    }[] = []

    for (const link of found) {
      const parsed = parseHref(link.href, link.page)
      if (parsed.kind === "external") continue
      if (parsed.kind === "bad") {
        push({
          page: link.page,
          link: link.text,
          href: link.href,
          why: parsed.why,
        })
        continue
      }
      const leaf = leafOf(router, routes, parsed.pathname)
      if (!leaf || isNotFound(leaf) || leaf.id === "__root__") {
        const why = !leaf
          ? `matched no route for ${parsed.pathname}`
          : isNotFound(leaf)
            ? `matched the not-found page ${leaf.id}`
            : `matched only the root layout for ${parsed.pathname}`
        push({ page: link.page, link: link.text, href: link.href, why })
        continue
      }
      if (parsed.hash.length > 0) {
        hashes.push({
          page: link.page,
          text: link.text,
          href: link.href,
          pathname: parsed.pathname,
          hash: parsed.hash,
        })
      }
    }

    for (const link of hashes) {
      let ids = idsByPath.get(link.pathname)
      if (!ids) {
        try {
          const read = await readPage(link.pathname)
          ids = read.ids
          idsByPath.set(link.pathname, ids)
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          push({
            page: link.page,
            link: link.text,
            href: link.href,
            why: `could not render ${link.pathname} to check id ${JSON.stringify(link.hash)}: ${message}`,
          })
          continue
        }
      }
      if (!ids.has(link.hash)) {
        push({
          page: link.page,
          link: link.text,
          href: link.href,
          why: `no element with id ${JSON.stringify(link.hash)} on ${link.pathname}`,
        })
      }
    }

    if (failures.length > 0) {
      throw new Error(failures.map(formatLink).join("\n\n"))
    }
  }, 30_000)
})
