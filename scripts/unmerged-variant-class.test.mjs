import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { unmergedVariantClasses } from "./lib/unmerged-variant-class.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")

const scannedFiles = () =>
  execFileSync(
    "git",
    [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "apps/web/src",
      "packages/ui/src",
    ],
    { cwd: root, encoding: "utf8" }
  )
    .split("\n")
    .filter((file) => /\.(tsx|ts)$/.test(file))
    .filter((file) => !/\.test\.tsx?$/.test(file))
    .filter((file) => existsSync(path.join(root, file)))

const MISTAKES = `export const Proofs = () => (
  <Link className={buttonVariants({ variant: "ghost", className: "h-11 px-0" })}>Proofs</Link>
)
export const Apply = ({ className }) => (
  <a className={buttonVariants({ variant: "outline", className })}>Apply</a>
)
export const Tag = () => <span className={badgeVariants({ class: "px-0" })} />`

const CLEAN = `export const Proofs = () => (
  <Link className={cn(buttonVariants({ variant: "ghost" }), "h-11 px-0")}>Proofs</Link>
)
export function Button({ className, variant, size }) {
  return <button className={cn(buttonVariants({ variant, size, className }))} />
}
export const Plain = () => <a className={buttonVariants({ variant: "outline" })}>Go</a>`

test("a variants call that takes className outside cn fires", () => {
  assert.deepEqual(
    unmergedVariantClasses(MISTAKES, "apps/web/src/features/x.tsx").map(
      (problem) => problem.split(":")[1]
    ),
    ["2", "5", "7"]
  )
})

test("a variants call merged by cn, or with no className, stays quiet", () => {
  assert.deepEqual(
    unmergedVariantClasses(CLEAN, "apps/web/src/features/x.tsx"),
    []
  )
})

test("no app or kit file passes className to a variants call outside cn", () => {
  const problems = scannedFiles().flatMap((file) =>
    unmergedVariantClasses(readFileSync(path.join(root, file), "utf8"), file)
  )
  assert.deepEqual(problems, [])
})
