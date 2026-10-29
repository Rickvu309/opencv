import path from "node:path"
import { loadEnv } from "vite"

import { localDevUrls } from "../../packages/domain/src/local-ports"

/**
 * Reads the repo-root `.env` (the file `scripts/ocv-tools.mjs take` writes) and, when
 * `VITE_API_URL` is not set anywhere, derives it from `PORT`. An explicit
 * `VITE_API_URL` always wins, so Railway builds are unchanged.
 */
export function applyLocalApiUrl(mode: string) {
  const env = loadEnv(mode, path.resolve(__dirname, "../.."), "")
  const urls = localDevUrls(env.PORT)
  process.env.VITE_API_URL = env.VITE_API_URL || urls.apiUrl
  return urls
}
