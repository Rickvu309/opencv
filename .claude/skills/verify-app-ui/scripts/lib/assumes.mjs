// Everything the app-ui checker assumes about the app, in one place. The checks read their folders, routes,
// stages and selectors from here or from app source. apps/web/src/test/verify-assumptions.test.ts holds each
// entry against the repo on every push, so a rename fails there before a run goes STALE.
import { readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { SURFACE_PATHS } from "../../../../../apps/web/src/lib/product-paths.ts"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..")
const FEATURES = "apps/web/src/features"
// Not signed-in app source: landing is marketing, auth is the sign-in screens, seed is sample data with no UI.
const NOT_SIGNED_IN = ["landing", "auth", "seed"]
export const featureFolders = () =>
  readdirSync(join(root, FEATURES))
    .filter(
      (name) =>
        !NOT_SIGNED_IN.includes(name) &&
        statSync(join(root, FEATURES, name)).isDirectory()
    )
    .map((name) => `${FEATURES}/${name}`)

export const ROUTES_DIR = "apps/web/src/routes"
export const PALETTE_DIR = `${FEATURES}/command-palette`
export const SOURCE_FILES = {
  conflictBanner:
    "apps/web/src/features/paper/paper-editor-conflict-banner.tsx",
  jobStages: "packages/domain/src/job.ts",
}

// The surfaces the tour walks, in order. Each carries one primary action marker.
export const TOURED = ["coach", "paper", "apply", "pitch"]

// The toured routes, each taken from the app's own path table.
export const PATHS = {
  coach: SURFACE_PATHS.coach,
  paper: SURFACE_PATHS.paper,
  apply: SURFACE_PATHS.apply,
  pitch: SURFACE_PATHS.pitch,
  inbox: SURFACE_PATHS.inbox,
  settings: SURFACE_PATHS.settings,
  signIn: "/sign-in",
}

const REQUESTS = "apps/web/src/lib/requests.ts"
export const PAPER_PATH = "/api/paper"
export const JOBS_PATH = "/api/jobs"
export const commandPath = (name) => `/api/commands/${name}`
// pattern is a regular expression over the URL path; the test finds it in a string or template of `source`.
export const API = {
  paperList: { method: "GET", pattern: `^${PAPER_PATH}$`, source: REQUESTS },
  jobsList: { method: "GET", pattern: `^${JOBS_PATH}$`, source: REQUESTS },
  coachTurn: {
    method: "POST",
    pattern: "^/api/chats/[^/]+/turns$",
    source: "apps/web/src/lib/coach-stream.ts",
  },
  command: {
    method: "POST",
    pattern: "^/api/commands/[^/]+$",
    source: "apps/web/src/lib/contract-client.ts",
  },
}
export const apiMatches = (request, api) =>
  request.method === api.method &&
  new RegExp(api.pattern).test(new URL(request.url).pathname)

// Selectors the probe and the tour use for app markup. Plain tags and ARIA roles are not listed.
export const SEL = {
  card: "[data-card-id]",
  lane: '[data-slot="board-lane"]',
  paperEditor: "[data-paper-editor]",
  paperCard: "main button[aria-label]",
  userContent: "[data-user-content]",
  primary: "[data-primary-action]",
  emptyState: '[data-slot="empty"]',
}

export const HIDDEN_STAGE = "closed"
// job.ts imports zod, so plain node reads the JOB_STAGES array literal instead of the module.
// verify-assumptions.test.ts holds the parse to jobStageSchema, the domain's export.
export function jobStages() {
  const text = readFileSync(join(root, SOURCE_FILES.jobStages), "utf8")
  const literal = /(?:export\s+)?const JOB_STAGES = \[([^\]]*)\]/.exec(
    text
  )?.[1]
  const stages = [...(literal ?? "").matchAll(/"([a-z-]+)"/g)].map((m) => m[1])
  return stages.length ? stages : null
}
export const boardStages = () =>
  jobStages()?.filter((s) => s !== HIDDEN_STAGE) ?? null

export const ASSUMES = {
  folders: [...featureFolders(), ROUTES_DIR, PALETTE_DIR],
  files: Object.values(SOURCE_FILES),
  routes: Object.values(PATHS),
  apiPaths: Object.values(API),
  selectors: Object.values(SEL),
  markers: [
    {
      attr: "data-primary-action",
      surface: "coach",
      file: "apps/web/src/features/coach/coach-dock.tsx",
    },
    {
      attr: "data-primary-action",
      surface: "paper",
      file: "apps/web/src/features/paper/paper-library.tsx",
    },
    {
      attr: "data-primary-action",
      surface: "apply",
      file: "apps/web/src/features/apply/apply-toolbar.tsx",
    },
    {
      attr: "data-primary-action",
      surface: "pitch",
      file: "apps/web/src/features/coming-soon/pitch-page.tsx",
    },
  ],
}
