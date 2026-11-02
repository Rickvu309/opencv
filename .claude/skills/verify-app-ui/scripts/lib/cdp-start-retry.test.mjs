import assert from "node:assert/strict"
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"

import { launchBrowser } from "./cdp.mjs"

const fakeChrome = (dir, firstRun) => {
  const counter = join(dir, "count")
  const script = join(dir, "fake-chrome.sh")
  writeFileSync(
    script,
    [
      "#!/bin/sh",
      `echo x >> ${counter}`,
      `if [ "$(wc -l < ${counter})" -eq 1 ]; then ${firstRun}; fi`,
      'echo "DevTools listening on ws://127.0.0.1:1/devtools/browser/fake" >&2',
      "sleep 30",
    ].join("\n")
  )
  chmodSync(script, 0o755)
  return { script, counter }
}

const withFakeChrome = async (firstRun, body) => {
  const scratch = join(homedir(), "tmp")
  mkdirSync(scratch, { recursive: true })
  const dir = mkdtempSync(join(scratch, "cdp-retry-"))
  const previous = process.env.CHROME_BIN
  const fake = fakeChrome(dir, firstRun)
  process.env.CHROME_BIN = fake.script
  try {
    await body(fake)
  } finally {
    if (previous === undefined) delete process.env.CHROME_BIN
    else process.env.CHROME_BIN = previous
    rmSync(dir, { recursive: true, force: true })
  }
}

const launches = (counter) =>
  readFileSync(counter, "utf8").split("\n").filter(Boolean).length

test("a Chrome that prints nothing before the deadline is started once more", async () => {
  await withFakeChrome("exec sleep 30", async ({ counter }) => {
    await assert.rejects(
      launchBrowser({ startDeadlineMs: 300 }),
      /devtools socket failed/
    )
    assert.equal(launches(counter), 2)
  })
})

test("a Chrome that never prints is given up on after two starts", async () => {
  await withFakeChrome("exec sleep 30", async ({ counter }) => {
    writeFileSync(
      process.env.CHROME_BIN,
      `#!/bin/sh\necho x >> ${counter}\nexec sleep 30\n`
    )
    await assert.rejects(
      launchBrowser({ startDeadlineMs: 200 }),
      /chrome did not start after \d+ ms/
    )
    assert.equal(launches(counter), 2)
  })
})

test("a Chrome that exits at start is not retried", async () => {
  await withFakeChrome("exit 1", async ({ counter }) => {
    await assert.rejects(
      launchBrowser({ startDeadlineMs: 5000 }),
      /chrome exited at start/
    )
    assert.equal(launches(counter), 1)
  })
})
