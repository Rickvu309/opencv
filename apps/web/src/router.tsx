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
  type RouterHistory,
} from "@tanstack/react-router"

import { fetchProfile } from "@/lib/account-api.ts"
import {
  SURFACE_PATHS,
  SURFACES,
  legacyAppPath,
  startPagePath,
} from "@/lib/product-paths.ts"

import { NotFoundPage, UnknownShell } from "@/components/not-found-page.tsx"
import {
  isSettingsSection,
  validateSettingsSearch,
} from "@/features/settings/sections.ts"
import { validateApplySearch } from "@/features/apply/apply-search.ts"
import { validatePaperSearch } from "@/features/paper/paper-templates.ts"
import { findBlogPost } from "@/features/landing/blog/blog-copy.ts"
import { SignInPage } from "@/routes/sign-in.tsx"
import { authClient } from "@/lib/auth-client.ts"
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

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: async ({ location }) => {
    if (isPublicHost()) return
    const onAppHost = isAppHost()
    let data
    try {
      data = (await authClient.getSession()).data
    } catch (error) {
      if (isRedirect(error)) throw error
      if (onAppHost) throw redirect({ href: startPagePath("apply") })
      throw error
    }
    if (!data) {
      if (!onAppHost) return
      throw redirect({ href: signInHref(locationHref(location)) })
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
    const { data } = await authClient.getSession()
    if (data) {
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
  try {
    const { data } = await authClient.getSession()
    return { signedIn: Boolean(data) }
  } catch (error) {
    if (isRedirect(error)) throw error
    return { signedIn: false }
  }
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
  beforeLoad: async ({ location }) => {
    try {
      const { data } = await authClient.getSession()
      if (!data) {
        throw redirect({ href: signInHref(locationHref(location)) })
      }
      return { session: data }
    } catch (error) {
      if (isRedirect(error)) throw error
      return { session: null }
    }
  },
  component: lazyRouteComponent(
    () => import("@/features/app-shell/app-shell-layout.tsx"),
    "AppShellLayout"
  ),
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

const shareRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/share/$token",
  component: lazyRouteComponent(
    () => import("@/routes/paper-share.tsx"),
    "PaperSharePage"
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

const hiddenRoutes = SURFACES.filter((surface) => !surface.shown).map(
  (surface) =>
    createRoute({
      getParentRoute: () => productLayoutRoute,
      path: surface.path,
      beforeLoad: redirectHiddenSurface,
      component: () => null,
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
    const { data } = await authClient.getSession()
    if (!data)
      throw redirect({
        href: signInHref(
          authorizationResumePath(location.pathname, window.location.search)
        ),
      })
  },
  component: lazyRouteComponent(
    () => import("@/features/connections/index.ts"),
    "ConnectionConsent"
  ),
})

const connectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/oauth/connect",
  beforeLoad: async ({ location }) => {
    const { data } = await authClient.getSession()
    if (!data)
      throw redirect({
        href: signInHref(
          authorizationResumePath(location.pathname, window.location.search)
        ),
      })
  },
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
  shareRoute,
  userRoute.addChildren([userMissRoute]),
  legacyAppRoute,
  legacyAppSplatRoute,
  productLayoutRoute.addChildren([
    paperRoute,
    paperDocRoute,
    applyRoute,
    applyJobRoute,
    coachRoute,
    settingsRoute,
    ...hiddenRoutes,
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
