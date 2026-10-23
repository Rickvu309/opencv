import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

const replacements = [
  ["OpenPathLogo", "OpenCvLogo"],
  ["OpenPathMark", "OpenCvMark"],
  ["OpenPath", "OpenCV"],
  ['"name": "openpath"', '"name": "opencv"'],
  ["openpath:", "opencv:"],
  ["x-openpath-apply-card", "x-opencv-apply-card"],
  ["openpath-app.vercel.app", "opencv.me"],
  ["openpath.app", "opencv.me"],
  ["openpath-dev", "opencv-dev"],
  ["openpath-*-", "opencv-*-"],
  ["openpath-git-", "opencv-git-"],
  ["openpath-build", "opencv-build"],
  ["openpath-<build>", "opencv-<build>"],
  ["openpath--", "opencv--"],
  ["rickvudev.vercel.app", "example.vercel.app"],
  ["5432/openpath", "5432/opencv"],
  ["invalid/openpath", "invalid/opencv"],
]

const files = [
  ".env.example",
  "AGENTS.md",
  "CONTEXT.md",
  "PRODUCT.md",
  "README.md",
  "docs/agents/issue-tracker.md",
  "package.json",
  "packages/domain/src/apply.ts",
  "packages/domain/src/starter.ts",
  "packages/ui/src/foundations/type.stories.tsx",
  "packages/ui/src/lib/brand.ts",
  "apps/web/index.html",
  "apps/web/src/features/app-shell/app-logo.tsx",
  "apps/web/src/features/app-shell/app-sidebar.tsx",
  "apps/web/src/features/app-shell/search-modal.tsx",
  "apps/web/src/features/apply/apply-types.ts",
  "apps/web/src/features/auth/auth-screen.tsx",
  "apps/web/src/features/home/aim-prompt.ts",
  "apps/web/src/features/home/first-cafe-checklist.ts",
  "apps/web/src/features/paper/coach-float.tsx",
  "apps/web/src/features/paper/paper-cv-types.ts",
  "apps/web/src/features/paper/paper-data.test.ts",
  "apps/web/src/features/paper/paper-editor.tsx",
  "apps/web/src/features/pitch/pitch-api.test.ts",
  "apps/web/src/features/pitch/pitch-types.test.ts",
  "apps/web/src/features/pitch/pitch-types.ts",
  "apps/web/src/features/pitch/pitch-workspace.test.tsx",
  "apps/web/src/features/seed/sample-author.ts",
  "apps/web/src/routes/app-shell.test.tsx",
  "apps/web/src/routes/paper.test.tsx",
  "apps/web/src/test/paper-seam.test.ts",
  "apps/web/src/test/thread-fixtures.ts",
  "apps/api/src/app.test.ts",
  "apps/api/src/apply/fetch-posting.ts",
  "apps/api/src/auth.test.ts",
  "apps/api/src/auth.ts",
  "apps/api/src/config.test.ts",
  "apps/api/src/coach/bind.test.ts",
  "apps/api/src/coach/eval/judge.ts",
  "apps/api/src/coach/eval/seed.ts",
  "apps/api/src/coach/prompt.ts",
  "apps/api/src/coach/runtime.ts",
  "apps/api/src/coach/smoke.ts",
  "apps/api/src/coach/title.test.ts",
  "apps/api/src/coach/title.ts",
  "apps/api/src/coach/tools.test.ts",
  "apps/api/src/origin.ts",
  "apps/api/src/starter/content.test.ts",
  "apps/api/src/test/harness.ts",
]

const forbidden = [
  "docs/specs/",
  "docs/research/",
  "docs/adr/",
  "apps/api/drizzle/",
  "pnpm-lock.yaml",
  "node_modules/",
]

let changed = 0
for (const file of files) {
  if (forbidden.some((prefix) => file.startsWith(prefix))) {
    throw new Error(`allowlist contains a protected path: ${file}`)
  }
  const path = join(root, file)
  const before = readFileSync(path, "utf8")
  const after = replacements.reduce(
    (text, [from, to]) => text.split(from).join(to),
    before
  )
  if (after !== before) {
    writeFileSync(path, after)
    changed += 1
  }
}
console.log(`rename-opencv: ${changed} of ${files.length} files changed`)
