/**
 * Base URL of the API, baked in at build time. The Railway `web` service sets
 * `VITE_API_URL` per environment (production → production API, staging →
 * staging API); locally it falls back to the dev server port in `.env.example`.
 */
export const apiBaseUrl =
  import.meta.env.VITE_API_URL || "http://localhost:3001"
