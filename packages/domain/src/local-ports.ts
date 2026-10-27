const DEFAULT_API_PORT = 3001
const DEFAULT_WEB_PORT = 5173

export interface LocalDevUrls {
  apiPort: number
  webPort: number
  apiUrl: string
  webOrigin: string
}

/**
 * The one place that turns `PORT` into every local dev address. The api listens
 * on `PORT` and the web dev server on `PORT + 1`, the pair `scripts/new-task.sh`
 * reserves per worktree. Unset or invalid `PORT` keeps the classic 3001/5173.
 */
export function localDevUrls(port: string | undefined): LocalDevUrls {
  const parsed = Number(port?.trim())
  const valid = Number.isInteger(parsed) && parsed > 0 && parsed <= 65535
  const apiPort = valid ? parsed : DEFAULT_API_PORT
  const webPort = valid ? parsed + 1 : DEFAULT_WEB_PORT
  return {
    apiPort,
    webPort,
    apiUrl: `http://localhost:${apiPort}`,
    webOrigin: `http://localhost:${webPort}`,
  }
}
