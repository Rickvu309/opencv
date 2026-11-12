import { BLOG_POSTS } from "@/features/landing/blog/blog-copy.ts"

export type RouteKind =
  "marketing" | "app" | "auth" | "share" | "not-found" | "layout"

export type RouteClass = {
  id: string
  fullPath: string
  kind: RouteKind
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
  { id: "/oauth/consent", fullPath: "/oauth/consent", kind: "auth" },
  { id: "/oauth/connect", fullPath: "/oauth/connect", kind: "auth" },
  { id: "/share/$token", fullPath: "/share/$token", kind: "share" },
  { id: "/app", fullPath: "/app", kind: "layout" },
  { id: "/app/$", fullPath: "/app/$", kind: "layout" },
  { id: "/product", fullPath: "/", kind: "layout" },
  { id: "/product/paper", fullPath: "/paper", kind: "app" },
  { id: "/product/paper/$docId", fullPath: "/paper/$docId", kind: "app" },
  { id: "/product/apply", fullPath: "/apply", kind: "app" },
  { id: "/product/apply/$jobId", fullPath: "/apply/$jobId", kind: "app" },
  { id: "/product/coach", fullPath: "/coach", kind: "app" },
  { id: "/product/inbox", fullPath: "/inbox", kind: "app" },
  {
    id: "/product/settings/{-$section}",
    fullPath: "/settings/{-$section}",
    kind: "app",
  },
  { id: "/$", fullPath: "/$", kind: "not-found" },
  { id: "/$/", fullPath: "/$/", kind: "not-found" },
]
