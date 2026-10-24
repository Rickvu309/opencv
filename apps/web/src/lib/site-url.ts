const publicOrigin = "https://opencv.me"
const appOrigin = "https://app.opencv.me"

export function siteOrigins(origin: string) {
  const hostname = new URL(origin).hostname
  const production = ["opencv.me", "www.opencv.me", "app.opencv.me"].includes(
    hostname
  )
  return production
    ? { public: publicOrigin, app: appOrigin }
    : { public: origin, app: origin }
}

export function appHref(path: string, origin = window.location.origin) {
  const target = siteOrigins(origin).app
  return target === origin ? path : new URL(path, target).href
}

export function publicHref(path: string, origin = window.location.origin) {
  return new URL(path, siteOrigins(origin).public).href
}

export function siteRedirect(
  href: string,
  origin = window.location.origin
): string | undefined {
  const url = new URL(href, origin)
  const sites = siteOrigins(origin)
  if (sites.app === sites.public) return undefined

  if (origin === sites.app) {
    if (url.pathname === "/")
      return new URL("/app" + url.search + url.hash, sites.app).href
    if (url.pathname.startsWith("/u/"))
      return publicHref(url.pathname + url.search + url.hash, origin)
  } else if (/^\/(?:app(?:\/|$)|sign-in$|sign-up$)/.test(url.pathname)) {
    return appHref(url.pathname + url.search + url.hash, origin)
  }
  return undefined
}
