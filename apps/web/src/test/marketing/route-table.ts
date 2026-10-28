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
  { id: "/stories", fullPath: "/stories", kind: "marketing" },
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
  { id: "/app", fullPath: "/app", kind: "layout" },
  { id: "/app/$", fullPath: "/app/$", kind: "layout" },
  { id: "/product", fullPath: "/", kind: "layout" },
  { id: "/product/home", fullPath: "/home", kind: "app" },
  { id: "/product/paper", fullPath: "/paper", kind: "app" },
  { id: "/product/paper/$docId", fullPath: "/paper/$docId", kind: "app" },
  { id: "/product/apply", fullPath: "/apply", kind: "app" },
  { id: "/product/apply/$jobId", fullPath: "/apply/$jobId", kind: "app" },
  { id: "/product/pitch", fullPath: "/pitch", kind: "app" },
  { id: "/product/coach", fullPath: "/coach", kind: "app" },
  { id: "/product/jobs", fullPath: "/jobs", kind: "app" },
  { id: "/product/proofs", fullPath: "/proofs", kind: "app" },
  { id: "/product/proof", fullPath: "/proof", kind: "app" },
  { id: "/product/inbox", fullPath: "/inbox", kind: "app" },
  {
    id: "/product/settings/billing/upgrade",
    fullPath: "/settings/billing/upgrade",
    kind: "app",
  },
  {
    id: "/product/settings/{-$section}",
    fullPath: "/settings/{-$section}",
    kind: "app",
  },
  { id: "/$", fullPath: "/$", kind: "not-found" },
  { id: "/$/", fullPath: "/$/", kind: "not-found" },
]
