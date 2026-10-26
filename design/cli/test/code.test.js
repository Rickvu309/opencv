import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  existsSync,
  statSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { loadKit } from "../src/kit.js"
import {
  registry,
  resolveComponents,
  resolveScreen,
  SCREENS,
} from "../src/code/registry.js"
import {
  DEFAULT_CONFIG,
  rewriteImports,
  routesFor,
} from "../src/code/project.js"
import { themeCss } from "../src/code/theme.js"
import { lintSource } from "../src/code/lint-code.js"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const bin = join(root, "bin", "opencv.js")
const run = (cwd, ...args) =>
  execFileSync("node", [bin, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  })
const kit = loadKit()
const rules = (src, file = "a.tsx") =>
  lintSource(file, src, kit)
    .filter((f) => f.level !== "info")
    .map((f) => f.rule)
const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory()
      ? f === "node_modules"
        ? []
        : walk(p)
      : [p]
  })

test("registry: every screen resolves and every import is in the registry", () => {
  const reg = registry()
  for (const s of SCREENS) {
    const r = resolveScreen([s.name])
    assert.deepEqual(r.missing, [], s.name)
    for (const c of r.components)
      assert.ok(reg.components[c], `${s.name} uses ${c}`)
  }
  for (const c of Object.values(reg.components))
    for (const d of c.deps) assert.ok(reg.components[d], `${c.name} uses ${d}`)
})

test("registry: components resolve by export name with their dependencies", () => {
  const { files, missing } = resolveComponents(["JobCard", "ConfirmDelete"])
  assert.deepEqual(missing, [])
  for (const f of ["apply", "overlay", "button", "brand", "cn"])
    assert.ok(files.includes(f), f)
  assert.deepEqual(resolveComponents(["NotAThing"]).missing, ["NotAThing"])
})

test("rewriteImports points the placeholders at the configured folders", () => {
  const src =
    "import { Button } from '~components/button';\nimport { jobs } from '~app/data';"
  const out = rewriteImports(src, "/p/src/screens", "/p", DEFAULT_CONFIG)
  assert.match(out, /from '\.\.\/components\/opencv\/button'/)
  assert.match(out, /from '\.\.\/app\/data'/)
  assert.doesNotMatch(out, /~/)
  const dq = rewriteImports(
    'import { Button } from "~components/button";',
    "/p/src/screens",
    "/p",
    DEFAULT_CONFIG
  )
  assert.match(dq, /from "\.\.\/components\/opencv\/button"/)
})

test("routesFor prints a route per screen", () => {
  const { routes } = routesFor(["job-detail", "settings"], DEFAULT_CONFIG)
  assert.match(routes, /path="\/apply\/:id"/)
  assert.match(routes, /path="\/settings\/:section\?"/)
})

test("themeCss maps the kit tokens to Tailwind theme names", () => {
  const css = themeCss(kit)
  assert.match(css, /@theme/)
  for (const name of [
    "--color-surface",
    "--color-fg-2",
    "--color-border",
    "--radius-card",
    "--text-body: 13px",
    "--shadow-glow",
  ])
    assert.ok(css.includes(name), name)
  assert.match(css, /@utility glow-button/)
  assert.doesNotMatch(css, /#E8542A/i)
})

test("code lint catches the decisions we made", () => {
  const bad = `export const A = () => (
    <div className="bg-accent">
      <h1>Welcome to OpenCV</h1>
      <p>Jun 2025 — now</p>
      <button className="bg-black text-white">Go</button>
      <span style={{ color: '#F0A060' }}>x</span>
      <i>Connected</i>
    </div>
  );`
  const found = rules(bad)
  for (const r of [
    "orange-accent",
    "brand-name",
    "em-dash",
    "black-primary",
    "warm-tint",
    "connected",
  ])
    assert.ok(found.includes(r), r)
})

test("code lint stays quiet on on-system code and comments", () => {
  const good = `// OpenCV — only in a comment
  export const B = () => <><Brand lead="Log in to" /><Button variant="primary">Add job</Button><p className="text-fg-2">Jun 2025 to now</p></>;`
  assert.deepEqual(rules(good), [])
})

test("the registry itself passes code lint", () => {
  const files = walk(join(root, "registry")).filter((f) =>
    /\.(tsx?|css)$/.test(f)
  )
  const bad = files
    .flatMap((f) => lintSource(f, readFileSync(f, "utf8"), kit))
    .filter((f) => f.level !== "info")
  assert.deepEqual(
    bad.map((f) => `${f.file}:${f.line} ${f.rule}`),
    []
  )
})

test("cli: new writes a complete app with no placeholders left", () => {
  const dir = join(mkdtempSync(join(tmpdir(), "opencv-new-")), "app")
  run(root, "new", dir)
  for (const f of [
    "package.json",
    "vite.config.ts",
    "index.html",
    "opencv.json",
    "src/main.tsx",
    "src/styles/opencv.css",
    "src/components/opencv/button.tsx",
    "src/screens/apply-board.tsx",
    "src/app/app-frame.tsx",
    "public/logos/outlook.png",
  ]) {
    assert.ok(existsSync(join(dir, f)), f)
  }
  const src = walk(join(dir, "src"))
    .map((f) => readFileSync(f, "utf8"))
    .join("\n")
  assert.doesNotMatch(src, /'~(components|app)\//)
  const main = readFileSync(join(dir, "src/main.tsx"), "utf8")
  for (const s of SCREENS)
    assert.match(
      main,
      new RegExp(`path="${s.route.replace(/[?]/g, "\\?")}"`),
      s.name
    )
  assert.match(run(dir, "lint"), /0 errors, 0 warnings/)
  assert.match(run(dir, "doctor"), /ok +opencv\.json/)
})

test("cli: init then screen adds a screen to an existing project", () => {
  const dir = mkdtempSync(join(tmpdir(), "opencv-init-"))
  run(dir, "init")
  assert.ok(existsSync(join(dir, "opencv.json")))
  assert.ok(existsSync(join(dir, "src/styles/opencv.css")))
  const out = run(dir, "screen", "inbox")
  assert.match(out, /path="\/inbox"/)
  assert.ok(existsSync(join(dir, "src/screens/inbox.tsx")))
  assert.ok(existsSync(join(dir, "src/components/opencv/inbox.tsx")))
  assert.throws(() => run(dir, "screen", "nope"))
})
