import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  isRedirect,
  lazyRouteComponent,
  redirect,
  type AnyRouter,
  type RouterHistory,
} from "@tanstack/react-router"

import { getShellProfile } from "@/features/app-shell/shell-api.ts"
import { startPagePath } from "@/features/app-shell/start-page.ts"

import { NotFoundPage } from "@/components/not-found-page.tsx"
import { validateSettingsSearch } from "@/features/app-shell/surfaces.ts"
import { validateApplySearch } from "@/features/apply/apply-search.ts"
import { validatePaperSearch } from "@/features/paper/paper-search.ts"
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
          const profile = await getShellProfile()
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
      const profile = await getShellProfile()
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

const applyRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/apply",
  validateSearch: validateApplySearch,
  component: lazyRouteComponent(
    () => import("@/routes/apply.tsx"),
    "ApplyPage"
  ),
})

const pitchRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/pitch",
  component: lazyRouteComponent(
    () => import("@/routes/pitch.tsx"),
    "PitchPage"
  ),
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
  component: lazyRouteComponent(
    () => import("@/routes/placeholder.tsx"),
    "JobsPage"
  ),
})

const proofsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/proofs",
  component: lazyRouteComponent(
    () => import("@/routes/placeholder.tsx"),
    "ProofsPage"
  ),
})

const inboxRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/inbox",
  component: lazyRouteComponent(
    () => import("@/routes/placeholder.tsx"),
    "InboxPage"
  ),
})

const settingsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/settings",
  validateSearch: validateSettingsSearch,
  component: lazyRouteComponent(
    () => import("@/routes/settings.tsx"),
    "SettingsPage"
  ),
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  pricingRoute,
  signInRoute,
  signUpRoute,
  appLayoutRoute.addChildren([
    appIndexRoute,
    homeRoute,
    paperRoute,
    applyRoute,
    pitchRoute,
    coachRoute,
    jobsRoute,
    proofsRoute,
    inboxRoute,
    settingsRoute,
  ]),
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
