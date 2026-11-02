import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const read = (file) => readFileSync(path.join(root, file), "utf8")

test("every web test starts with the clock pinned to TEST_NOW", () => {
  const setup = read("apps/web/src/test/setup.ts")
  assert.match(
    setup,
    /import \{ pinTestClock \} from "\.\/test-clock\.ts"/,
    "apps/web/src/test/setup.ts must import pinTestClock so no web test sees the real date. Anchor fixtures to TEST_NOW from apps/web/src/test/test-clock.ts instead of a date literal near today."
  )
  assert.match(
    setup,
    /beforeEach\(\(\) => \{\s*pinTestClock\(\)/,
    "apps/web/src/test/setup.ts must call pinTestClock() first in its beforeEach. A test that reads the real date breaks on the day it leaves the week its fixtures name."
  )
})

test("the pinned clock fakes Date only, so waitFor and user-event timers stay real", () => {
  const clock = read("apps/web/src/test/test-clock.ts")
  assert.match(clock, /vi\.useFakeTimers\(\{ toFake: \["Date"\] \}\)/)
  assert.match(clock, /vi\.setSystemTime\(TEST_NOW\)/)
})
