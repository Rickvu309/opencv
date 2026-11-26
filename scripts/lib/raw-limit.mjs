const QUIET = [
  "apps/api/src/limits/",
  "apps/api/src/auth-email-limit.ts",
  "apps/api/src/paper/import/import-parse.ts",
  "apps/api/src/paper/http.ts",
  "apps/api/src/app.ts",
  "apps/api/src/coach/worker.ts",
]

function quiet(file) {
  return QUIET.some((prefix) => file === prefix || file.startsWith(prefix))
}

export function detect(text, file = "") {
  if (!file || file.includes(".test.") || file.includes("/test/")) return []
  if (quiet(file)) return []
  if (!/\b429\b|\b503\b/.test(text)) return []
  if (!/new Response|\bc\.json\b|jsonWithStatus/.test(text)) return []
  if (/x-limit/.test(text)) return []
  return [
    `${file} answers 429 or 503 without an x-limit catalog id such as export.running`,
  ]
}
