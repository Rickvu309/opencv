/**
 * Base URL of the API, baked in at build time. Vercel sets `VITE_API_URL` per
 * environment (production → production API, preview → staging API); locally it
 * falls back to the dev server port in `.env.example`.
 */
export const apiBaseUrl =
  import.meta.env.VITE_API_URL || "http://localhost:3001"
