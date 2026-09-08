import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  type AnyRouter,
  type RouterHistory,
} from "@tanstack/react-router"

import { AppShellLayout } from "@/features/app-shell/app-shell-layout.tsx"
import { validateSettingsSearch } from "@/features/app-shell/surfaces.ts"
import { validateApplySearch } from "@/features/apply/apply-search.ts"
import { validatePaperSearch } from "@/features/paper/paper-search.ts"
import { ApplyPage } from "@/routes/apply.tsx"
import { HomePage } from "@/routes/home.tsx"
import { PaperPage } from "@/routes/paper.tsx"
import { PitchPage } from "@/routes/pitch.tsx"
import { SearchPage } from "@/routes/search.tsx"
import { SettingsPage } from "@/routes/settings.tsx"
import { SignInPage } from "@/routes/sign-in.tsx"
import { SignUpPage } from "@/routes/sign-up.tsx"
import { authClient } from "@/lib/auth-client.ts"
import { validateAuthSearch } from "@/lib/auth-redirect.ts"

const rootRoute = createRootRoute({
  component: () => <Outlet />,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/app" })
  },
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
  component: AppShellLayout,
})

const homeRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/",
  component: HomePage,
})

const paperRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/paper",
  validateSearch: validatePaperSearch,
  component: PaperPage,
})

const searchRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/search",
  component: SearchPage,
})

const applyRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/apply",
  validateSearch: validateApplySearch,
  component: ApplyPage,
})

const pitchRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/pitch",
  component: PitchPage,
})

const settingsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/settings",
  validateSearch: validateSettingsSearch,
  component: SettingsPage,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  signInRoute,
  signUpRoute,
  appLayoutRoute.addChildren([
    homeRoute,
    searchRoute,
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
