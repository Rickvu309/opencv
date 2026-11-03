const DEFAULT_API_PORT = 3001
const DEFAULT_WEB_PORT = 5173
const WEB_PORT_OFFSET = 1000

export const WORKTREE_PORTS = Object.freeze({ first: 4000, last: 4999 })

interface LocalDevUrls {
  apiPort: number
  webPort: number
  apiUrl: string
  webOrigin: string
}

export function localDevUrls(port: string | undefined): LocalDevUrls {
  const parsed = Number(port?.trim())
  const valid = Number.isInteger(parsed) && parsed > 0 && parsed <= 65535
  const apiPort = valid ? parsed : DEFAULT_API_PORT
  const webPort = valid ? parsed + WEB_PORT_OFFSET : DEFAULT_WEB_PORT
  return {
    apiPort,
    webPort,
    apiUrl: `http://localhost:${apiPort}`,
    webOrigin: `http://localhost:${webPort}`,
  }
}
