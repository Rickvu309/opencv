import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { LANDING_CSS, detect } from "./lib/landing-sticky-hover.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")

const landingStyles = () =>
  execFileSync(
    "git",
    [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "apps/web/src/features/landing",
    ],
    { cwd: root, encoding: "utf8" }
  )
    .split("\n")
    .filter((file) => LANDING_CSS.test(file))
    .filter((file) => existsSync(path.join(root, file)))

test("a landing hover that a phone tap leaves stuck fires", () => {
  const found = detect(`.lm-root:hover .lm-track,
.lm-root[data-paused] .lm-track {
  animation-play-state: paused;
}

@media (min-width: 48rem) {
  .landing-link:hover {
    color: var(--foreground);
  }
}`)
  assert.deepEqual(
    found.map((item) => item.line),
    [1, 7]
  )
})

test("a landing hover gated to a fine pointer stays quiet", () => {
  assert.deepEqual(
    detect(`.lm-root[data-paused] .lm-track {
  animation-play-state: paused;
}

@media (hover: hover) and (pointer: fine) {
  .lm-root:hover .lm-track {
    animation-play-state: paused;
  }
}

.landing-link:active {
  opacity: 0.7;
}`),
    []
  )
})

test("no landing style leaves a hover state stuck after a tap", () => {
  const problems = landingStyles().flatMap((file) =>
    detect(readFileSync(path.join(root, file), "utf8")).map(
      (item) => `${file}:${item.line} ${item.why}`
    )
  )
  assert.deepEqual(problems, [])
})
