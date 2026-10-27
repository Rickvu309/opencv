/**
 * Base URL of the API, baked in at build time. The Railway `web` service sets
 * `VITE_API_URL` per environment (production -> production API, staging ->
 * staging API). Locally `local-env.ts` derives it from `PORT`.
 */
export const apiBaseUrl: string = import.meta.env.VITE_API_URL
