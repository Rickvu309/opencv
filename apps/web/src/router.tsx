import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  redirect,
  type AnyRouter,
  type RouterHistory,
} from "@tanstack/react-router"

import { NotFoundPage } from "@/components/not-found-page.tsx"
import { validateSettingsSearch } from "@/features/app-shell/surfaces.ts"
import { validateApplySearch } from "@/features/apply/apply-search.ts"
import { validatePaperSearch } from "@/features/paper/paper-search.ts"
import { SignInPage } from "@/routes/sign-in.tsx"
import { SignUpPage } from "@/routes/sign-up.tsx"
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
  beforeLoad: async () => {
    const { data } = await authClient.getSession()
    if (data) {
      throw redirect({ href: "/app" })
    }
  },
  component: SignUpPage,
})

const appLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/app",
  beforeLoad: async ({ location }) => {
    const { data } = await authClient.getSession()
    if (!data) {
      throw redirect({
        to: "/sign-in",
        search: { redirect: `${location.pathname}${location.searchStr}` },
      })
    }
    return { session: data }
  },
  component: lazyRouteComponent(
    () => import("@/features/app-shell/app-shell-layout.tsx"),
    "AppShellLayout"
  ),
})

const homeRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/",
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

const settingsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/settings",
  validateSearch: validateSettingsSearch,
  component: lazyRouteComponent(
    () => import("@/routes/settings.tsx"),
    "SettingsPage"
  ),
})

const PublicPitchPage = lazyRouteComponent(
  () => import("@/features/pitch/pitch-public-page.tsx"),
  "PublicPitchPage"
)

const publicPitchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/u/$slug",
  component: function PublicPitchRoute() {
    const { slug } = publicPitchRoute.useParams()
    return <PublicPitchPage slug={slug} />
  },
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  pricingRoute,
  signInRoute,
  signUpRoute,
  publicPitchRoute,
  appLayoutRoute.addChildren([
    homeRoute,
    paperRoute,
    applyRoute,
    pitchRoute,
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
