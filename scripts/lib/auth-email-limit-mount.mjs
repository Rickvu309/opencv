import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../..")

export const APP_FILE = "apps/api/src/app.ts"
export const ROUTES_FILE = "apps/api/src/auth-routes.ts"
export const LIMIT_FILE = "apps/api/src/auth-email-limit.ts"

export const LIBRARY_CODE_SENDING_ROUTES = Object.freeze([
  "/email-otp/send-verification-otp",
  "/email-otp/request-email-change",
  "/email-otp/request-password-reset",
  "/forget-password/email-otp",
])

const workingTree = {
  read: (name) =>
    existsSync(path.join(root, name))
      ? readFileSync(path.join(root, name), "utf8")
      : null,
}

const MOUNT = /app\.use\(\s*"\/api\/auth\/\*",\s*authEmailLimit\(/
const HANDLER = /app\.all\(\s*"\/api\/auth\/\*"/

function quotedRoutes(source) {
  return new Set(
    [...(source ?? "").matchAll(/"(\/[a-z0-9:/_-]+)"/gi)].map(
      (match) => match[1]
    )
  )
}

export function detect(
  source,
  file = "apps/api/src/auth.ts",
  io = workingTree
) {
  if (!/ipAddressHeaders/.test(source)) return []
  const app = io.read(APP_FILE) ?? ""
  const routes = io.read(ROUTES_FILE)
  const limited = quotedRoutes(io.read(LIMIT_FILE))
  const served = routes === null ? null : quotedRoutes(routes)
  const problems = []
  const mountAt = app.search(MOUNT)
  const handlerAt = app.search(HANDLER)
  if (mountAt < 0)
    problems.push(
      `${file} keys sign-in limits on a client address header, and ${APP_FILE} mounts no per-email limit on /api/auth/*`
    )
  else if (handlerAt >= 0 && mountAt > handlerAt)
    problems.push(
      `${APP_FILE} mounts the per-email limit after the auth handler, so it never runs`
    )
  for (const route of LIBRARY_CODE_SENDING_ROUTES) {
    if (served !== null && !served.has(route)) continue
    if (!limited.has(route))
      problems.push(
        `${route} sends a sign-in code and ${LIMIT_FILE} does not limit it per email`
      )
  }
  return problems
}
