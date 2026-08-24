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
import { ApplyPage } from "@/routes/apply.tsx"
import { HomePage } from "@/routes/home.tsx"
import { PaperPage } from "@/routes/paper.tsx"
import { PitchPage } from "@/routes/pitch.tsx"
import { SettingsPage } from "@/routes/settings.tsx"

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

const appLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/app",
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
  component: PaperPage,
})

const applyRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/apply",
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
