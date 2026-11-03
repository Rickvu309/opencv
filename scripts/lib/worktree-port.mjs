import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  WORKTREE_PORTS,
  localDevUrls,
} from "../../packages/domain/src/local-ports.ts"

const readEnvText = (repo) => {
  try {
    return readFileSync(join(repo, ".env"), "utf8")
  } catch {
    return ""
  }
}

export function portFromEnvText(text) {
  const match = /^PORT=["']?(\d+)["']?\s*$/m.exec(String(text ?? ""))
  return match ? Number(match[1]) : null
}

export function portInWorktreeRange(port) {
  return (
    Number.isInteger(port) &&
    port >= WORKTREE_PORTS.first &&
    port <= WORKTREE_PORTS.last
  )
}

export function resolveApiPort({ envPort, envText } = {}) {
  const typed = String(envPort ?? "").trim()
  const raw = typed !== "" ? Number(typed) : portFromEnvText(envText)
  return portInWorktreeRange(raw) ? raw : null
}

export function webPortFor(apiPort) {
  if (!portInWorktreeRange(apiPort)) return null
  const webPort = localDevUrls(String(apiPort)).webPort
  const band = WORKTREE_PORTS.last - WORKTREE_PORTS.first + 1
  const above =
    webPort > WORKTREE_PORTS.last && webPort <= WORKTREE_PORTS.last + band
  if (webPort - apiPort !== band || !above) return null
  return webPort
}

export function verifierPorts(apiPort) {
  const webPort = webPortFor(apiPort)
  if (webPort == null) return null
  return {
    apiPort,
    webPort,
    apiOrigin: `http://localhost:${apiPort}`,
    webOrigin: `http://localhost:${webPort}`,
  }
}

export function requireVerifierPorts(repo, env = process.env) {
  return verifierPorts(
    resolveApiPort({ envPort: env.PORT, envText: readEnvText(repo) })
  )
}

export function portError(name) {
  return `${name} error: set PORT to the PORT in this worktree .env (${WORKTREE_PORTS.first} to ${WORKTREE_PORTS.last}); the api uses PORT and the web PORT+1000`
}
