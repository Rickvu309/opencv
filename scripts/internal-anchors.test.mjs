import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import {
  anchorCounts,
  detect,
  isFeatureSource,
} from "./lib/internal-anchors.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const RATCHET = "scripts/internal-anchors.ratchet.json"

const MISTAKE = `
const paperHref = "/paper"
const jobHref = \`/apply/\${id}\`
<a href={paperHref}>Paper</a>
<a href={jobHref}>Job</a>
<a href={("/paper")}>Grouped</a>
<a href="/paper">Paper</a>
<a href={\`/paper/\${id}\`}>Name</a>
<a href={kind === "paper" ? SURFACE_PATHS.paper : SURFACE_PATHS.apply}>Go</a>
<a href={id ? \`/apply/\${id}\` : ""}>Maybe</a>
`

const CLEAN = `
<a href="https://example.com/jobs" target="_blank" rel="noopener noreferrer">Jobs</a>
<a href="#app-main">Skip</a>
<a href={url}>Posting</a>
<a data-href="/paper">Data</a>
<a href="https://example.com" data-path="/paper">External</a>
<a href={url} data-path="/paper">Posting</a>
<a href={url} title={SURFACE_PATHS.paper}>Posting</a>
<a data-href="/paper" href="https://example.com">Posting</a>
<a href={\`\${companyWebsite}/careers\`}>Careers</a>
<a title='href="/paper"' href="https://example.com">Title</a>
<a href={\`\${apiBaseUrl}\${downloadPath}\`} download>Word</a>
<a href={documentHref("/sign-in")}>Sign in</a>
<a href={inbox} target="_blank" rel="noreferrer" />
<a href="//cdn.example/app">CDN</a>
<Link to="/paper">Paper</Link>
<Link to={SURFACE_PATHS.paper}>Paper</Link>
<article href="/paper">Not an anchor</article>
`

test("the mistake fixture fires on a raw internal anchor", () => {
  const found = detect(MISTAKE, "mistake.tsx")
  assert.equal(found.length, 7)
  assert.match(found.join("\n"), /mistake\.tsx:4 raw internal anchor/)
  assert.match(found.join("\n"), /mistake\.tsx:6 raw internal anchor/)
})

test("the clean fixture stays quiet", () => {
  assert.deepEqual(detect(CLEAN, "clean.tsx"), [])
})

test("feature tests are not product anchors, and a product file is", () => {
  assert.equal(
    isFeatureSource(
      "apps/web/src/features/coach/coach-workspace.isolated.test.tsx"
    ),
    false
  )
  assert.equal(
    isFeatureSource("apps/web/src/features/coach/coach-workspace.tsx"),
    true
  )
})

test("features keep only the known internal anchors, and the ratchet only shrinks", () => {
  const known = JSON.parse(readFileSync(path.join(root, RATCHET), "utf8"))
  const files = execFileSync(
    "git",
    [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "apps/web/src/features",
    ],
    { cwd: root, encoding: "utf8" }
  )
    .split("\n")
    .filter(Boolean)
  const counts = anchorCounts(files, (file) =>
    readFileSync(path.join(root, file), "utf8")
  )
  const grew = Object.entries(counts)
    .filter(([file, count]) => count > (known[file] ?? 0))
    .map(
      ([file, count]) => `${file}: ${count} found, ${known[file] ?? 0} known`
    )
  assert.deepEqual(grew, [], "new raw internal anchors")
  const shrank = Object.entries(known)
    .filter(([file, count]) => (counts[file] ?? 0) < count)
    .map(
      ([file, count]) => `${file}: ${counts[file] ?? 0} found, ${count} known`
    )
  assert.deepEqual(
    shrank,
    [],
    `fixed anchors: lower or remove the entry in ${RATCHET}`
  )
  assert.deepEqual(Object.keys(known), Object.keys(known).sort())
})
