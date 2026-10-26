const START_PAGES = {
  apply: "/app/apply",
  paper: "/app/paper",
  inbox: "/app/inbox",
  coach: "/app/coach",
} as const

export function startPagePath(startPage: unknown) {
  if (typeof startPage === "string" && startPage in START_PAGES) {
    return START_PAGES[startPage as keyof typeof START_PAGES]
  }
  return START_PAGES.apply
}
