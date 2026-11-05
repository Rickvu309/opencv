import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")

const SOURCE = /^(?:apps|packages)\/[^/]+\/.+\.(?:[cm]?[jt]sx?)$/
const NOT_PRODUCT_CODE =
  /\.(?:test|type-test|spec|stories)\.[cm]?[jt]sx?$|\.d\.ts$|\/test\//

export const RULES = [
  {
    name: "clipboard",
    scope: /^(?:apps|packages)\//,
    hit: (source) =>
      /\bclipboard\s*\.\s*write(?:Text)?\s*\(|execCommand\(\s*["'`]copy["'`]/.test(
        source
      ),
    allowed: ["packages/ui/src/components/copy-button.tsx"],
    use: "CopyButton, or copyText for a copy that has no button, from @workspace/ui/components/copy-button. It already falls back to execCommand and toasts the result.",
  },
  {
    name: "spinner",
    scope: /^apps\//,
    hit: (source) => /animate-spin/.test(source),
    allowed: [],
    use: "Spinner from @workspace/ui/components/spinner instead of a spinning LoaderCircle or Loader2 icon.",
  },
  {
    name: "breadcrumb",
    scope: /^(?:apps|packages)\//,
    hit: (source) =>
      /aria-label\s*=\s*\{?\s*["'`][^"'`]*breadcrumb/i.test(source) ||
      (/aria-current\s*=\s*["']page["']/.test(source) &&
        /\bChevronRight(?:Icon)?\b/.test(source)),
    allowed: ["packages/ui/src/components/breadcrumb.tsx"],
    use: "Breadcrumb from @workspace/ui/components/breadcrumb instead of a hand-built nav with aria-label Breadcrumb or a crumb trail with aria-current page.",
  },
]

export function offenders(rule, files, read) {
  return files
    .filter((file) => rule.scope.test(file))
    .filter((file) => !rule.allowed.includes(file))
    .filter((file) => rule.hit(read(file)))
}

const productFiles = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard"],
  { cwd: root, encoding: "utf8" }
)
  .split("\n")
  .filter((file) => SOURCE.test(file) && !NOT_PRODUCT_CODE.test(file))
  .filter((file) => existsSync(path.join(root, file)))

const read = (file) => readFileSync(path.join(root, file), "utf8")

for (const rule of RULES) {
  test(`${rule.name}: no file rebuilds what the kit already has`, () => {
    const strays = offenders(rule, productFiles, read)
    assert.deepEqual(
      strays,
      [],
      `${strays.join(", ")} rebuilds the kit ${rule.name} by hand. Use ${rule.use}`
    )
  })
}

const byName = Object.fromEntries(RULES.map((rule) => [rule.name, rule]))

test("clipboard: the hand-rolled copy-link code that #844 deleted is caught", () => {
  const past = `
    try {
      await navigator.clipboard.writeText(publicShareUrl(token))
    } catch {
      document.execCommand("copy")
    }`
  assert.ok(byName.clipboard.hit(past))
  assert.ok(byName.clipboard.hit("navigator.clipboard\n  .writeText(value)"))
  assert.ok(byName.clipboard.hit("document.execCommand('copy')"))
})

test("clipboard: reading the clipboard and mocking execCommand are allowed", () => {
  assert.ok(!byName.clipboard.hit("await navigator.clipboard.readText()"))
  assert.ok(!byName.clipboard.hit("document.execCommand = () => false"))
})

test("spinner: a spinning icon is caught and the kit Spinner is not", () => {
  assert.ok(
    byName.spinner.hit(
      '<LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />'
    )
  )
  assert.ok(byName.spinner.hit('cn("motion-safe:animate-spin")'))
  assert.ok(!byName.spinner.hit("<Spinner />"))
})

test("breadcrumb: a hand-built nav and a crumb trail are caught", () => {
  assert.ok(
    byName.breadcrumb.hit('<nav aria-label="Breadcrumb" className="x">')
  )
  assert.ok(byName.breadcrumb.hit("<nav aria-label={'breadcrumbs'}>"))
  assert.ok(
    byName.breadcrumb.hit(
      '<ChevronRight /><span aria-current="page">New cover letter</span>'
    )
  )
})

test("breadcrumb: a nav link that marks the current page is allowed", () => {
  assert.ok(
    !byName.breadcrumb.hit('aria-current={current ? "page" : undefined}')
  )
  assert.ok(!byName.breadcrumb.hit('<a aria-current="page">Account</a>'))
  assert.ok(!byName.breadcrumb.hit('<nav aria-label="Settings">'))
})

test("the scan sees the kit file that is allowed", () => {
  assert.ok(productFiles.includes("packages/ui/src/components/copy-button.tsx"))
  assert.ok(productFiles.length > 200)
})
