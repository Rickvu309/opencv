import assert from "node:assert/strict"
import test from "node:test"
import { pushOk, world } from "./hook-world.mjs"

const SCAN = "apps/web/src/test/ui-kit-contract.test.ts"
const SONNER = "packages/ui/src/components/sonner.test.tsx"

test("pre-push runs the tests the change reaches, says why, and records the pass for the head", () => {
  const w = world({
    changed: [SONNER, "apps/web/src/lib/x.ts"],
    tests: [
      SCAN,
      SONNER,
      "apps/web/src/lib/x.test.ts",
      "apps/web/src/y.test.ts",
    ],
    testText: { "apps/web/src/lib/x.test.ts": 'import { x } from "./x"\n' },
  })
  const r = w.call(["pre-push"], { stdin: pushOk })
  assert.equal(r.code, 0, r.text)
  assert.match(r.text, /affected tests: 3 test file\(s\) selected/)
  assert.match(
    r.text,
    /ui-kit-contract\.test\.ts {2}\(scans the tree that holds/
  )
  assert.match(r.text, /x\.test\.ts {2}\(imports apps\/web\/src\/lib\/x\.ts\)/)
  const runs = w.s.calls.filter((c) => c.cmd.endsWith("/vitest"))
  assert.deepEqual(
    runs.map((c) => [
      c.options.cwd,
      c.args.filter((a) => /test\.tsx?$/.test(a)),
    ]),
    [
      [
        "/repo/apps/web",
        ["src/test/ui-kit-contract.test.ts", "src/lib/x.test.ts"],
      ],
      ["/repo/packages/ui", ["src/components/sonner.test.tsx"]],
    ]
  )
  assert.ok(!runs.some((c) => c.args.includes("src/y.test.ts")))
  assert.ok(
    w.s.calls.every((c) => !c.cmd.endsWith("/vitest") || c.args.length > 4),
    "a runner with no files would run the whole package suite"
  )
})

test("pre-push refuses when a reached test fails, and a recorded head is not run again", () => {
  const failing = world({
    changed: [SONNER],
    tests: [SCAN],
    failing: ["ui-kit-contract"],
  })
  const refused = failing.call(["pre-push"], { stdin: pushOk })
  assert.equal(refused.code, 2, refused.text)
  assert.match(
    refused.text,
    /REFUSED AFFECTED_TESTS: the tests this change reaches failed: tests apps\/web/
  )
  assert.match(refused.text, /Fix: Fix the failing tests/)
  const again = world({ changed: [SONNER], tests: [SCAN], receipt: true })
  const r = again.call(["pre-push"], { stdin: pushOk })
  assert.equal(r.code, 0, r.text)
  assert.match(r.text, /already passed at abc, not run again/)
  assert.equal(again.s.calls.filter((c) => c.cmd.endsWith("/vitest")).length, 0)
})

test("pre-push with SKIP_CHECKS and a named human runs no tests", () => {
  const w = world({
    changed: [SONNER],
    tests: [SCAN],
    failing: ["ui-kit-contract"],
    env: { SKIP_CHECKS: "1", SKIP_CHECKS_DECLARED_BY: "Ada" },
  })
  const r = w.call(["pre-push"], { stdin: pushOk })
  assert.equal(r.code, 0, r.text)
  assert.equal(w.s.calls.filter((c) => c.cmd.endsWith("/vitest")).length, 0)
})
