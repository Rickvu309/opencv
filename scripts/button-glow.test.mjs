import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { glowButtons } from "./lib/button-glow.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")

const MARKETING_SITE = "apps/web/src/features/landing/"

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
    .filter((file) => !file.startsWith(MARKETING_SITE))
    .filter((file) => existsSync(path.join(root, file)))

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

test("no button in the app features, shared components or the kit uses a glow, radial gradient or glow shadow", () => {
  const problems = scannedFiles().flatMap((file) =>
    glowButtons(readFileSync(path.join(root, file), "utf8"), file)
  )
  assert.deepEqual(problems, [])
})
