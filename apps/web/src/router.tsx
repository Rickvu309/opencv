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
import { startPagePath } from "@/features/app-shell/start-page.ts"

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
import { validateAuthSearch } from "@/lib/auth-redirect.ts"

const rootRoute = createRootRoute({
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

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: async () => {
    const { data } = await authClient.getSession()
    if (data) {
      throw redirect({ to: "/app" })
    }
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
      throw redirect({ href: search.redirect ?? "/app" })
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

function isAppIndex(pathname: string) {
  return pathname === "/app" || pathname === "/app/"
}

async function loadUnknownSession() {
  try {
    const { data } = await authClient.getSession()
    return { signedIn: Boolean(data) }
  } catch (error) {
    if (isRedirect(error)) throw error
    return { signedIn: false }
  }
}

const appLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/app",
  beforeLoad: async ({ location }) => {
    const index = isAppIndex(location.pathname)
    try {
      const { data } = await authClient.getSession()
      if (!data) {
        throw redirect({
          to: "/sign-in",
          search: { redirect: `${location.pathname}${location.searchStr}` },
        })
      }
      if (index) {
        let startPage: unknown = "apply"
        try {
          const profile = await fetchProfile()
          startPage = profile.startPage
        } catch (error) {
          if (isRedirect(error)) throw error
        }
        throw redirect({ href: startPagePath(startPage) })
      }
      return { session: data }
    } catch (error) {
      if (isRedirect(error)) throw error
      // A dead api throws. /app falls back to Apply. A child route renders
      // so the same failure does not redirect again.
      if (index) throw redirect({ href: startPagePath("apply") })
      return { session: null }
    }
  },
  component: lazyRouteComponent(
    () => import("@/features/app-shell/app-shell-layout.tsx"),
    "AppShellLayout"
  ),
})

const appIndexRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/",
  beforeLoad: async () => {
    let startPage: unknown = "apply"
    try {
      const profile = await fetchProfile()
      startPage = profile.startPage
    } catch (error) {
      if (isRedirect(error)) throw error
    }
    throw redirect({ href: startPagePath(startPage) })
  },
  component: () => null,
})

const homeRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/home",
  component: lazyRouteComponent(() => import("@/routes/home.tsx"), "HomePage"),
})

const paperRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/paper",
  validateSearch: validatePaperSearch,
  component: lazyRouteComponent(
    () => import("@/routes/paper.tsx"),
    "PaperPage"
  ),
})

const paperDocRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/paper/$docId",
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
  getParentRoute: () => appLayoutRoute,
  path: "/apply",
  validateSearch: validateApplySearch,
  component: lazyRouteComponent(
    () => import("@/routes/apply.tsx"),
    "ApplyPage"
  ),
})

const applyJobRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/apply/$jobId",
  component: lazyRouteComponent(
    () => import("@/routes/apply-job.tsx"),
    "ApplyJobPage"
  ),
})

// One import so Jobs, Proofs and Pitch share a chunk.
const comingSoonRoute = () => import("@/routes/coming-soon.tsx")

const pitchRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/pitch",
  component: lazyRouteComponent(comingSoonRoute, "PitchPage"),
})

const coachRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/coach",
  component: lazyRouteComponent(
    () => import("@/routes/coach.tsx"),
    "CoachPage"
  ),
})

const jobsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/jobs",
  component: lazyRouteComponent(comingSoonRoute, "JobsPage"),
})

const proofsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/proofs",
  component: lazyRouteComponent(comingSoonRoute, "ProofsPage"),
})

const proofAliasRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/proof",
  beforeLoad: () => {
    throw redirect({ href: "/app/proofs", replace: true })
  },
  component: () => null,
})

const inboxRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/inbox",
  component: lazyRouteComponent(
    () => import("@/routes/inbox.tsx"),
    "InboxPage"
  ),
})

const settingsUpgradeRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/settings/billing/upgrade",
  component: lazyRouteComponent(
    () => import("@/routes/settings.tsx"),
    "SettingsPage"
  ),
})

const settingsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/settings/{-$section}",
  validateSearch: validateSettingsSearch,
  beforeLoad: ({ params }) => {
    const section = params.section
    if (section && !isSettingsSection(section)) {
      throw redirect({ href: "/app/settings", replace: true })
    }
  },
  component: lazyRouteComponent(
    () => import("@/routes/settings.tsx"),
    "SettingsPage"
  ),
})

// Misses stay off the app layout. A session renders the 404 inside the shell.
// No session renders the bare 404, including /app/nothing, with no redirect.
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

const appMissRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/app/$",
  beforeLoad: loadUnknownSession,
  component: UnknownShell,
})

const appMissIndexRoute = createRoute({
  getParentRoute: () => appMissRoute,
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
  blogRoute,
  blogPostRoute,
  signInRoute,
  signUpRoute,
  shareRoute,
  userRoute.addChildren([userMissRoute]),
  appMissRoute.addChildren([appMissIndexRoute]),
  appLayoutRoute.addChildren([
    appIndexRoute,
    homeRoute,
    paperRoute,
    paperDocRoute,
    applyRoute,
    applyJobRoute,
    pitchRoute,
    coachRoute,
    jobsRoute,
    proofsRoute,
    proofAliasRoute,
    inboxRoute,
    settingsUpgradeRoute,
    settingsRoute,
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
