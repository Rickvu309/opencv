// Every route from createAppRouter, keyed by the TanStack route id.
// A route missing from this table fails the marketing check.
// A marketing route whose path contains `$` must set enumerate.

import { BLOG_POSTS } from "@/features/landing/blog/blog-copy.ts"

export type RouteKind =
  "marketing" | "app" | "auth" | "share" | "not-found" | "layout"

export type RouteClass = {
  id: string
  fullPath: string
  kind: RouteKind
  /**
   * Concrete paths for a marketing route with a param.
   * The `/blog/$slug` row returns one `/blog/<slug>` per post.
   */
  enumerate?: () => readonly string[]
}

export const ROUTE_TABLE: readonly RouteClass[] = [
  { id: "__root__", fullPath: "/", kind: "layout" },
  { id: "/", fullPath: "/", kind: "marketing" },
  { id: "/pricing", fullPath: "/pricing", kind: "marketing" },
  { id: "/about", fullPath: "/about", kind: "marketing" },
  { id: "/help", fullPath: "/help", kind: "marketing" },
  { id: "/blog", fullPath: "/blog", kind: "marketing" },
  {
    id: "/blog/$slug",
    fullPath: "/blog/$slug",
    kind: "marketing",
    enumerate: () => BLOG_POSTS.map((post) => `/blog/${post.slug}`),
  },
  { id: "/sign-in", fullPath: "/sign-in", kind: "auth" },
  { id: "/sign-up", fullPath: "/sign-up", kind: "auth" },
  { id: "/share/$token", fullPath: "/share/$token", kind: "share" },
  { id: "/u/$slug", fullPath: "/u/$slug", kind: "not-found" },
  { id: "/u/$slug/", fullPath: "/u/$slug/", kind: "not-found" },
  { id: "/app/$", fullPath: "/app/$", kind: "not-found" },
  { id: "/app/$/", fullPath: "/app/$/", kind: "not-found" },
  { id: "/app", fullPath: "/app", kind: "app" },
  { id: "/app/", fullPath: "/app/", kind: "app" },
  { id: "/app/home", fullPath: "/app/home", kind: "app" },
  { id: "/app/paper", fullPath: "/app/paper", kind: "app" },
  { id: "/app/paper/$docId", fullPath: "/app/paper/$docId", kind: "app" },
  { id: "/app/apply", fullPath: "/app/apply", kind: "app" },
  { id: "/app/apply/$jobId", fullPath: "/app/apply/$jobId", kind: "app" },
  { id: "/app/pitch", fullPath: "/app/pitch", kind: "app" },
  { id: "/app/coach", fullPath: "/app/coach", kind: "app" },
  { id: "/app/jobs", fullPath: "/app/jobs", kind: "app" },
  { id: "/app/proofs", fullPath: "/app/proofs", kind: "app" },
  { id: "/app/proof", fullPath: "/app/proof", kind: "app" },
  { id: "/app/inbox", fullPath: "/app/inbox", kind: "app" },
  {
    id: "/app/settings/billing/upgrade",
    fullPath: "/app/settings/billing/upgrade",
    kind: "app",
  },
  {
    id: "/app/settings/{-$section}",
    fullPath: "/app/settings/{-$section}",
    kind: "app",
  },
  { id: "/$", fullPath: "/$", kind: "not-found" },
  { id: "/$/", fullPath: "/$/", kind: "not-found" },
]
