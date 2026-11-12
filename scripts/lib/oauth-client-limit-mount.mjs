import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../..")

export const APP_FILE = "apps/api/src/app.ts"
export const LIMIT_FILE = "apps/api/src/oauth-client-limit.ts"

export const CLIENT_CREATING_ROUTES = Object.freeze([
  "/api/auth/oauth2/register",
  "/api/auth/oauth2/authorize",
  "/api/auth/oauth2/public-client-prelogin",
])

const workingTree = {
  read: (name) =>
    existsSync(path.join(root, name))
      ? readFileSync(path.join(root, name), "utf8")
      : null,
}

const OPEN_REGISTRATION = /allowUnauthenticatedClientRegistration:\s*true/
const MOUNT = /app\.use\(\s*"\/api\/auth\/oauth2\/\*",\s*oauthClientLimit\(/
const HANDLER = /app\.all\(\s*"\/api\/auth\/\*"/
const ADDRESS_KEY =
  /x-real-ip|x-forwarded-for|ipAddress|getConnInfo|remoteAddr/i
const BOUNDS = [
  "pendingClients",
  "pendingHours",
  "pendingGraceMinutes",
  "registrationBytes",
]
const SQL_TEMPLATE = /sql`([^`]*)`/g
const COUNT_RULE = /\boffset\s*\$\{\s*limits\.pendingClients\s*\}/
const AGE_FLOOR = /created_at\s*<\s*\$\{\s*graceStart\s*\}/
const GRACE_START =
  /graceStart\s*=\s*new Date\(\s*now\.getTime\(\)\s*-\s*limits\.pendingGraceMinutes\s*\*\s*60_000\s*\)/

export function countRulesWithoutAgeFloor(limit) {
  const graceComputed = GRACE_START.test(limit)
  return [...limit.matchAll(SQL_TEMPLATE)]
    .map((match) => match[1])
    .filter(
      (statement) =>
        COUNT_RULE.test(statement) &&
        !(graceComputed && AGE_FLOOR.test(statement))
    )
}

export function detect(
  source,
  file = "apps/api/src/auth.ts",
  io = workingTree
) {
  if (!OPEN_REGISTRATION.test(source)) return []
  const app = io.read(APP_FILE) ?? ""
  const limit = io.read(LIMIT_FILE)
  const problems = []
  const mountAt = app.search(MOUNT)
  const handlerAt = app.search(HANDLER)
  if (mountAt < 0)
    problems.push(
      `${file} lets anyone register agent clients without signing in, and ${APP_FILE} mounts no client limit on /api/auth/oauth2/*, so only the library's address-keyed limit bounds the rows`
    )
  else if (handlerAt >= 0 && mountAt > handlerAt)
    problems.push(
      `${APP_FILE} mounts the client limit after the auth handler, so it never runs`
    )
  if (limit === null) {
    problems.push(`${LIMIT_FILE} is missing`)
    return problems
  }
  if (ADDRESS_KEY.test(limit))
    problems.push(
      `${LIMIT_FILE} reads a client address, which a caller can change on every request`
    )
  for (const route of CLIENT_CREATING_ROUTES)
    if (!limit.includes(`"${route}"`))
      problems.push(
        `${route} can create a client row and ${LIMIT_FILE} does not sweep after it`
      )
  if (countRulesWithoutAgeFloor(limit).length > 0)
    problems.push(
      `${LIMIT_FILE} removes never-approved clients past the newest pendingClients with no age floor, so a burst of registrations removes a client whose person is still on the consent screen; keep clients younger than pendingGraceMinutes`
    )
  for (const bound of BOUNDS)
    if (!new RegExp(`\\b${bound}:\\s*\\d`).test(limit))
      problems.push(`${LIMIT_FILE} sets no ${bound} bound`)
  return problems
}
