import { authorizationResumePath } from "@/lib/oauth-consent.ts"
import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  isRedirect,
  lazyRouteComponent,
  notFound,
  redirect,
  type AnyRouter,
  type RouteComponent,
  type RouterHistory,
} from "@tanstack/react-router"

import { fetchProfile } from "@/lib/account-api.ts"
import {
  SURFACE_PATHS,
  SURFACES,
  legacyAppPath,
  startPagePath,
  type SurfaceId,
} from "@/lib/product-paths.ts"

import {
  NotFoundPage,
  UnknownShell,
} from "@/features/app-shell/not-found-page.tsx"
import {
  isSettingsSection,
  validateSettingsSearch,
} from "@/features/settings/sections.ts"
import { validateApplySearch } from "@/features/apply/apply-search.ts"
import { validatePaperSearch } from "@/features/paper/paper-templates.ts"
import { findBlogPost } from "@/features/landing/blog/blog-copy.ts"
import { SignInPage } from "@/routes/sign-in.tsx"
import {
  checkSession,
  SessionCheckUnknown,
  sessionToKeep,
} from "@/lib/session-check.ts"
import { SessionCheckErrorBoundary } from "@/features/auth/session-check-notice.tsx"
import { signInHref, validateAuthSearch } from "@/lib/auth-redirect.ts"
import { documentTarget } from "@/lib/web-origins.ts"
import { webOrigins } from "@/lib/web-origins-env.ts"

const rootRoute = createRootRoute({
  beforeLoad: ({ location }) => {
    const target = documentTarget(
      new URL(location.href, window.location.origin),
      webOrigins
    )
    if (target) throw redirect({ href: target, reloadDocument: true })
  },
  component: () => <Outlet />,
  notFoundComponent: () => <NotFoundPage />,
})

const pricingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/pricing",
  component: lazyRouteComponent(
    () => import("@/routes/landing-pricing.tsx"),
    "LandingPricingPage"
  ),
})

const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/about",
  component: lazyRouteComponent(
    () => import("@/routes/landing-about.tsx"),
    "LandingAboutPage"
  ),
})

const helpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/help",
  component: lazyRouteComponent(
    () => import("@/routes/landing-help.tsx"),
    "LandingHelpPage"
  ),
})

const storiesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/stories",
  component: lazyRouteComponent(
    () => import("@/routes/landing-stories.tsx"),
    "LandingStoriesPage"
  ),
})

const blogRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/blog",
  component: lazyRouteComponent(
    () => import("@/routes/landing-blog.tsx"),
    "LandingBlogPage"
  ),
})

const blogPostRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/blog/$slug",
  beforeLoad: ({ params }) => {
    if (!findBlogPost(params.slug)) throw notFound()
  },
  component: lazyRouteComponent(
    () => import("@/routes/landing-blog-post.tsx"),
    "LandingBlogPostPage"
  ),
})

function isPublicHost() {
  return (
    webOrigins.kind === "split" &&
    webOrigins.publicHosts.includes(window.location.hostname)
  )
}

function isAppHost() {
  return (
    webOrigins.kind === "split" &&
    window.location.hostname === webOrigins.appHost
  )
}

function locationHref(location: {
  pathname: string
  searchStr: string
  hash: string
}) {
  return `${location.pathname}${location.searchStr}${location.hash ? `#${location.hash}` : ""}`
}

async function requireSession(resumeHref: string) {
  const check = await checkSession()
  if (check.kind === "signed-out")
    throw redirect({ href: signInHref(resumeHref) })
  const session = sessionToKeep(check)
  if (!session) throw new SessionCheckUnknown()
  return { session, sessionCheck: check.kind }
}

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: async ({ location }) => {
    if (isPublicHost()) return
    const onAppHost = isAppHost()
    const check = await checkSession()
    if (check.kind === "signed-out") {
      if (!onAppHost) return
      throw redirect({ href: signInHref(locationHref(location)) })
    }
    if (!sessionToKeep(check)) {
      if (onAppHost) throw redirect({ href: startPagePath("apply") })
      return
    }
    let startPage: unknown = "apply"
    try {
      const profile = await fetchProfile()
      startPage = profile.startPage
    } catch (error) {
      if (isRedirect(error)) throw error
    }
    throw redirect({ href: startPagePath(startPage) })
  },
  component: lazyRouteComponent(
    () => import("@/features/landing/landing-page.tsx"),
    "LandingPage"
  ),
})

const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sign-in",
  validateSearch: validateAuthSearch,
  beforeLoad: async ({ search }) => {
    const check = await checkSession()
    if (check.kind === "signed-in") {
      throw redirect({ href: search.redirect ?? "/" })
    }
  },
  component: SignInPage,
})

const signUpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sign-up",
  validateSearch: validateAuthSearch,
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/sign-in",
      search: search.redirect ? { redirect: search.redirect } : {},
    })
  },
  component: () => null,
})

async function loadUnknownSession() {
  return { signedIn: sessionToKeep(await checkSession()) !== null }
}

function legacyBeforeLoad({
  location,
}: {
  location: { pathname: string; searchStr: string; hash: string }
}) {
  const next = legacyAppPath(locationHref(location))
  if (next) throw redirect({ href: next, replace: true })
}

const legacyAppRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/app",
  beforeLoad: legacyBeforeLoad,
  component: () => null,
})

const legacyAppSplatRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/app/$",
  beforeLoad: legacyBeforeLoad,
  component: () => null,
})

const productLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "product",
  beforeLoad: ({ location }) => requireSession(locationHref(location)),
  component: lazyRouteComponent(
    () => import("@/routes/product-layout.tsx"),
    "ProductLayout"
  ),
  errorComponent: SessionCheckErrorBoundary,
})

const paperRoute = createRoute({
  getParentRoute: () => productLayoutRoute,
  path: "/paper",
  validateSearch: validatePaperSearch,
  component: lazyRouteComponent(
    () => import("@/routes/paper.tsx"),
    "PaperPage"
  ),
})

const paperDocRoute = createRoute({
  getParentRoute: () => productLayoutRoute,
  path: "/paper/$docId",
  validateSearch: validatePaperSearch,
  component: lazyRouteComponent(
    () => import("@/routes/paper-doc.tsx"),
    "PaperDocPage"
  ),
})

const applyRoute = createRoute({
  getParentRoute: () => productLayoutRoute,
  path: "/apply",
  validateSearch: validateApplySearch,
  component: lazyRouteComponent(
    () => import("@/routes/apply.tsx"),
    "ApplyPage"
  ),
})

const applyJobRoute = createRoute({
  getParentRoute: () => productLayoutRoute,
  path: "/apply/$jobId",
  component: lazyRouteComponent(
    () => import("@/routes/apply-job.tsx"),
    "ApplyJobPage"
  ),
})

async function redirectHiddenSurface() {
  let startPage: unknown = "apply"
  try {
    const profile = await fetchProfile()
    startPage = profile.startPage
  } catch (error) {
    if (isRedirect(error)) throw error
  }
  throw redirect({ href: startPagePath(startPage), replace: true })
}

const coachRoute = createRoute({
  getParentRoute: () => productLayoutRoute,
  path: "/coach",
  validateSearch: (search: Record<string, unknown>) => ({
    chat: typeof search.chat === "string" ? search.chat : undefined,
  }),
  component: lazyRouteComponent(
    () => import("@/routes/coach.tsx"),
    "CoachPage"
  ),
})

const surfacePagesShareOneChunk = () => import("@/routes/coming-soon.tsx")

type SurfacePageRoute = {
  component: RouteComponent
  beforeLoad?: () => Promise<void> | void
}

const SURFACE_PAGE_ROUTES: Partial<Record<SurfaceId, SurfacePageRoute>> = {
  inbox: {
    component: lazyRouteComponent(
      () => import("@/routes/inbox.tsx"),
      "InboxPage"
    ),
  },
  jobs: {
    component: lazyRouteComponent(surfacePagesShareOneChunk, "JobsPage"),
  },
  pitch: {
    component: lazyRouteComponent(surfacePagesShareOneChunk, "PitchPage"),
  },
  proofs: {
    component: lazyRouteComponent(surfacePagesShareOneChunk, "ProofsPage"),
  },
  proof: {
    beforeLoad: () => {
      throw redirect({ href: SURFACE_PATHS.proofs, replace: true })
    },
    component: () => null,
  },
}

const HIDDEN_SURFACE_ROUTE: SurfacePageRoute = {
  beforeLoad: redirectHiddenSurface,
  component: () => null,
}

const surfaceRoutes = SURFACES.filter(
  (surface) => !surface.shown || surface.id in SURFACE_PAGE_ROUTES
).map((surface) =>
  createRoute({
    getParentRoute: () => productLayoutRoute,
    path: surface.path,
    ...((surface.shown && SURFACE_PAGE_ROUTES[surface.id]) ||
      HIDDEN_SURFACE_ROUTE),
  })
)

const settingsRoute = createRoute({
  getParentRoute: () => productLayoutRoute,
  path: "/settings/{-$section}",
  validateSearch: validateSettingsSearch,
  beforeLoad: ({ params }) => {
    const section = params.section
    if (section && !isSettingsSection(section)) {
      throw redirect({ href: SURFACE_PATHS.settings, replace: true })
    }
  },
  component: lazyRouteComponent(
    () => import("@/routes/settings.tsx"),
    "SettingsPage"
  ),
})

const consentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/oauth/consent",
  beforeLoad: async ({ location }) => {
    await requireSession(
      authorizationResumePath(location.pathname, window.location.search)
    )
  },
  errorComponent: SessionCheckErrorBoundary,
  component: lazyRouteComponent(
    () => import("@/features/connections/index.ts"),
    "ConnectionConsent"
  ),
})

const connectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/oauth/connect",
  beforeLoad: async ({ location }) => {
    await requireSession(
      authorizationResumePath(location.pathname, window.location.search)
    )
  },
  errorComponent: SessionCheckErrorBoundary,
  component: lazyRouteComponent(
    () => import("@/features/connections/index.ts"),
    "ContinueConnection"
  ),
})

const userRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/u/$slug",
  beforeLoad: loadUnknownSession,
  component: UnknownShell,
})

const userMissRoute = createRoute({
  getParentRoute: () => userRoute,
  path: "/",
  component: NotFoundPage,
})

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"])

const paperLabRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/paper-lab",
  beforeLoad: () => {
    if (!LOOPBACK_HOSTS.has(window.location.hostname)) throw notFound()
  },
  component: lazyRouteComponent(
    () => import("@/routes/paper-lab.tsx"),
    "PaperLabPage"
  ),
})

const rootSplatRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "$",
  beforeLoad: loadUnknownSession,
  component: UnknownShell,
})

const rootSplatIndexRoute = createRoute({
  getParentRoute: () => rootSplatRoute,
  path: "/",
  component: NotFoundPage,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  pricingRoute,
  aboutRoute,
  helpRoute,
  storiesRoute,
  blogRoute,
  blogPostRoute,
  signInRoute,
  signUpRoute,
  consentRoute,
  connectRoute,
  userRoute.addChildren([userMissRoute]),
  legacyAppRoute,
  legacyAppSplatRoute,
  paperLabRoute,
  productLayoutRoute.addChildren([
    paperRoute,
    paperDocRoute,
    applyRoute,
    applyJobRoute,
    coachRoute,
    settingsRoute,
    ...surfaceRoutes,
  ]),
  rootSplatRoute.addChildren([rootSplatIndexRoute]),
])

export function createAppRouter(options?: { history?: RouterHistory }) {
  return createRouter({
    routeTree,
    history: options?.history,
  })
}

declare module "@tanstack/react-router" {
  interface Register {
    router: AnyRouter
  }
}
