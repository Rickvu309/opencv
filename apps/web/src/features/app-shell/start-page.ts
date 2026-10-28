import { START_PAGES } from "@/lib/product-paths.ts"

export { START_PAGES }

function isStartPage(value: string): value is keyof typeof START_PAGES {
  return value in START_PAGES
}

export function startPagePath(startPage: unknown) {
  if (typeof startPage === "string" && isStartPage(startPage)) {
    return START_PAGES[startPage]
  }
  return START_PAGES.apply
}
