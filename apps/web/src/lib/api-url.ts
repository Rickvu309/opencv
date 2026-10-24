/** Deployed clients use the host proxy; local development may override it. */
export const apiBaseUrl =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? "http://localhost:3001" : window.location.origin)
