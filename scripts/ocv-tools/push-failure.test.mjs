import assert from "node:assert/strict"
import test from "node:test"

import { explainPushFailure } from "./push-failure.mjs"

const FIRST = "REFUSED QUICK_CHECKS: the quick checks failed: prettier"

test("a failing pre-push names the guard and the first error line", () => {
  const out = `${FIRST}\nFix: format the changed files\n`
  const err = `${"x".repeat(2000)}\nerror: failed to push some refs to 'github.com:Rickvu309/opencv.git'\n`
  assert.throws(
    () => {
      throw new Error(
        explainPushFailure({ out, err, logPath: "/tmp/push.log" })
      )
    },
    (error) => {
      const message = error.message.slice(0, 800)
      assert.match(message, /QUICK_CHECKS/)
      assert.match(message, /prettier/)
      assert.match(
        message,
        new RegExp(FIRST.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      )
      assert.match(message, /\/tmp\/push\.log/)
      return true
    }
  )
})

test("a guard on stdout is kept when stderr is only the git refusal", () => {
  const message = explainPushFailure({
    out: "REFUSED FILE_SIZE: file is over the limit\n",
    err: "error: failed to push some refs to 'github.com:Rickvu309/opencv.git'\n",
    logPath: "/tmp/push.log",
  })
  assert.match(message.slice(0, 800), /FILE_SIZE/)
  assert.match(message, /REFUSED FILE_SIZE: file is over the limit/)
})
