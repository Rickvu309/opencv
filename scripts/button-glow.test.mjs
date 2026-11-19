import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { GLOW_SHADOW_KIND, glowButtons } from "./lib/button-glow.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")

const MARKETING_SITE = "apps/web/src/features/landing/"
const SIGNATURE_BUTTON = "apps/web/src/components/signature-button.ts"
const SIGNATURE_USERS = [
  "apps/web/src/features/coach/coach-dock.tsx",
  "apps/web/src/features/landing/landing-button.ts",
]

const scannedFiles = () =>
  execFileSync(
    "git",
    [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "apps/web/src/features",
      "apps/web/src/components",
      "packages/ui/src",
    ],
    { cwd: root, encoding: "utf8" }
  )
    .split("\n")
    .filter(
      (file) =>
        /\.(tsx|ts)$/.test(file) ||
        (file.startsWith("packages/ui/src/styles/") && file.endsWith(".css"))
    )
    .filter((file) => !/\.test\.tsx?$/.test(file))
    .filter((file) => existsSync(path.join(root, file)))

const wearsSignatureMesh = (file) =>
  file.startsWith(MARKETING_SITE) || file === SIGNATURE_BUTTON

const OLD_SIGNATURE_BUTTON = `const signatureMesh = "border-0 [background-image:radial-gradient(ellipse_90%_85%_at_55%_60%,var(--ring),transparent_72%)]"
export const signatureButton = \`\${signatureMesh} ring-0 shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--background)_70%,transparent),0_2px_10px_color-mix(in_oklch,var(--ring)_30%,transparent)]\`
export const signatureIconButton =
  "border-0 bg-card ring-1 ring-inset ring-[color-mix(in_oklch,var(--ring)_32%,transparent)] shadow-[0_1px_2px_color-mix(in_oklch,var(--ring)_28%,transparent),0_2px_6px_color-mix(in_oklch,var(--ring)_16%,transparent)]"`

const OLD_LANDING_PLAN = `const PLAN = {
  white: cn(
    buttonVariants({ variant: "ghost" }),
    "bg-card shadow-[0_2px_10px_color-mix(in_oklch,var(--ring)_30%,transparent)] ring-1 ring-inset"
  ),
} as const`

const OLD_KIT_BUTTON = `const glowButton =
  "glow text-foreground hover:brightness-[0.97] active:brightness-[0.94]"
const buttonVariants = cva("inline-flex", {
  variants: { variant: { primary: "bg-primary", glow: glowButton } },
})`

const OLD_CALL_SITES = `export const New = () => <Button variant="glow">New</Button>
export const Open = () => (
  <a href="/paper/1" className={\`inline-flex h-11 rounded-[7px] glow px-2.5 \${HIT}\`}>Open</a>
)
export const Halo = () => (
  <button className="bg-[radial-gradient(ellipse_at_center,var(--ring),transparent)] shadow-[0_2px_10px_var(--ring)]">Go</button>
)`

const OLD_KIT_CSS = `@utility glow {
  background-image: radial-gradient(60% 70% at 55% 60%, var(--ring) 0%, transparent 70%);
}`

test("the old glow button style fires in the kit, at call sites and in kit CSS", () => {
  assert.equal(
    glowButtons(OLD_KIT_BUTTON, "packages/ui/src/components/button.tsx").length,
    1
  )
  assert.deepEqual(
    glowButtons(OLD_CALL_SITES, "apps/web/src/features/x.tsx").map((p) =>
      p.replace(/^[^:]+:\d+: /, "")
    ),
    [
      "a Button variant uses the glow style",
      "a a class uses the glow style",
      "a button class uses a radial gradient",
      "a button class uses a coloured glow shadow",
    ]
  )
  assert.equal(
    glowButtons(OLD_KIT_CSS, "packages/ui/src/styles/globals.css").length,
    2
  )
})

test("a lavender glow shadow on the landing Get started and plan buttons and the Coach send button fires", () => {
  assert.deepEqual(
    glowButtons(OLD_SIGNATURE_BUTTON, SIGNATURE_BUTTON).map((p) =>
      p.replace(/^[^:]+:/, "")
    ),
    [
      `2: a button style uses ${GLOW_SHADOW_KIND}`,
      `4: a button style uses ${GLOW_SHADOW_KIND}`,
    ]
  )
  assert.deepEqual(
    glowButtons(
      OLD_LANDING_PLAN,
      "apps/web/src/features/landing/landing-button.ts"
    ).map((p) => p.replace(/^[^:]+:/, "")),
    [`4: a button style uses ${GLOW_SHADOW_KIND}`]
  )
})

test("an inset hairline in the accent and a neutral soft shadow on a button stay quiet", () => {
  const quiet = `export const signatureButton = "ring-0 shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--ring)_40%,transparent)]"
export const signatureIconButton = "ring-1 ring-inset shadow-[0_1px_2px_color-mix(in_oklch,var(--foreground)_8%,transparent)]"
export const plan = "bg-card shadow-none ring-1 ring-inset"`
  assert.deepEqual(glowButtons(quiet, SIGNATURE_BUTTON), [])
})

test("the solid primary, the quiet receipt link and a gradient on a page surface stay quiet", () => {
  const clean = `const primaryButton = "rounded-md bg-primary text-primary-foreground hover:bg-[color-mix(in_oklch,var(--primary),var(--primary-foreground)_12%)]"
const buttonVariants = cva("inline-flex", { variants: { variant: { primary: primaryButton } } })
export const New = () => <Button variant="primary" size="sm">New</Button>
export const Open = () => <a href="/p" className="inline-flex rounded-[7px] px-2.5 text-foreground hover:bg-muted">Open</a>
export const Hero = () => <div className="bg-[radial-gradient(ellipse_55%_65%_at_85%_45%,var(--muted),var(--card))]" />`
  assert.deepEqual(
    glowButtons(clean, "packages/ui/src/components/button.tsx"),
    []
  )
})

test("no button in the app features, shared components or the kit uses a glow, radial gradient or glow shadow, and the signature buttons wear no glow shadow", () => {
  const problems = scannedFiles().flatMap((file) =>
    glowButtons(readFileSync(path.join(root, file), "utf8"), file).filter(
      (problem) =>
        !wearsSignatureMesh(file) || problem.endsWith(GLOW_SHADOW_KIND)
    )
  )
  assert.deepEqual(problems, [])
})

test("only the landing calls to action and the Coach send button wear the signature button", () => {
  const users = execFileSync(
    "git",
    [
      "grep",
      "-l",
      "--untracked",
      "-e",
      "components/signature-button",
      "--",
      "apps/web/src",
      "packages/ui/src",
    ],
    { cwd: root, encoding: "utf8" }
  )
    .split("\n")
    .filter(Boolean)
    .filter((file) => !/\.test\.tsx?$/.test(file))
    .sort()
  assert.deepEqual(users, SIGNATURE_USERS)
})
