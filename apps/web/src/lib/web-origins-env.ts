import { documentTarget, resolveWebOrigins, shareUrl } from "./web-origins.ts"

export const webOrigins = resolveWebOrigins({
  publicOrigin: import.meta.env.VITE_PUBLIC_ORIGIN,
  appOrigin: import.meta.env.VITE_APP_ORIGIN,
})

export function documentHref(path: string) {
  return (
    documentTarget(new URL(path, window.location.origin), webOrigins) ?? path
  )
}

export function publicShareUrl(token: string) {
  return shareUrl(token, window.location.origin, webOrigins)
}
