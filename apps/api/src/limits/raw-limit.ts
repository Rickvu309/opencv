import { LIMITS } from "@workspace/domain/limits"

const QUIET_PREFIXES = [
  "/api/auth",
  "/api/paper",
  "/api/coach",
  "/api/chats",
  "/health",
]

function quietPath(path: string) {
  return QUIET_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  )
}

export function rawLimitProblem(
  status: number,
  path: string,
  header: string | null
) {
  if (status !== 429 && status !== 503) return null
  if (quietPath(path)) return null
  if (header && Object.hasOwn(LIMITS, header)) return null
  return `A ${status} from ${path} needs an x-limit catalog id such as export.running.`
}

function requestPath(input: unknown) {
  if (typeof input === "string") {
    const bare = input.split("?")[0] ?? input
    if (bare.startsWith("http://") || bare.startsWith("https://"))
      return new URL(bare).pathname
    return bare.startsWith("/") ? bare : `/${bare}`
  }
  if (input instanceof URL) return input.pathname
  if (input instanceof Request) return new URL(input.url).pathname
  return "/"
}

type RequestArgs = [string | URL | Request, RequestInit?, unknown?, unknown?]

export function installRawLimitCheck(app: object) {
  const target = app as {
    request: (...args: RequestArgs) => Response | Promise<Response>
  }
  const request = target.request.bind(target)
  target.request = async (...args) => {
    const res = await request(...args)
    const problem = rawLimitProblem(
      res.status,
      requestPath(args[0]),
      res.headers.get("x-limit")
    )
    if (problem) throw new Error(problem)
    return res
  }
}
