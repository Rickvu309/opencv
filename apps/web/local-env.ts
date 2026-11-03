import path from "node:path"
import { loadEnv } from "vite"

import { localDevUrls } from "../../packages/domain/src/local-ports"

export function applyLocalApiUrl(mode: string) {
  const env = loadEnv(mode, path.resolve(__dirname, "../.."), "")
  const urls = localDevUrls(env.PORT)
  process.env.VITE_API_URL = env.VITE_API_URL || urls.apiUrl
  return urls
}
