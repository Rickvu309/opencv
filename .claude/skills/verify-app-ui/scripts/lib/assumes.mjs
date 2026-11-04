import { readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { SURFACE_PATHS } from "../../../../../apps/web/src/lib/product-paths.ts"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..")
const FEATURES = "apps/web/src/features"
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
  jobStages: "packages/domain/src/job.ts",
}

export const TOURED = ["coach", "paper", "apply", "pitch"]

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
const JOB_STAGES_ARRAY_LITERAL_READ_WITHOUT_IMPORTING_ZOD =
  /(?:export\s+)?const JOB_STAGES = \[([^\]]*)\]/
export function jobStages() {
  const text = readFileSync(join(root, SOURCE_FILES.jobStages), "utf8")
  const literal =
    JOB_STAGES_ARRAY_LITERAL_READ_WITHOUT_IMPORTING_ZOD.exec(text)?.[1]
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
