import assert from "node:assert/strict"
import { EventEmitter } from "node:events"
import test from "node:test"
import { openScreen } from "./capture.mjs"

const STATE = {
  webOrigin: "http://localhost:5720",
  apiOrigin: "http://localhost:4720",
  repo: "/work/opencv.worktrees/1-demo",
  logs: { web: "/scratch/ocv-ui/1-demo/web.log" },
}

const STAGESHOW_SCENE = "/src/features/landing/figures/phone/apply-scene.tsx"

const STEP_TIMEOUT = "Timeout 20000ms exceeded."

function pageThatFails(fault) {
  const page = new EventEmitter()
  page.goto = async () => {
    for (const { origin = STATE.webOrigin, path, status } of fault.responses ??
      [])
      page.emit("response", {
        url: () => `${origin}${path}`,
        status: () => status,
      })
    if (fault.pageError) page.emit("pageerror", new Error(fault.pageError))
  }
  page.locator = () => ({
    first: () => ({
      waitFor: () =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(STEP_TIMEOUT)), 200)
        ),
    }),
  })
  return page
}

function browserWith(page) {
  return {
    newContext: async () => ({
      newPage: async () => page,
      close: async () => {},
    }),
  }
}

const LANDING = {
  id: "landing",
  route: "/",
  signedIn: false,
  steps: [{ waitFor: { selector: "#landing-hero" } }],
}

test("a lazy route whose module the web server cannot build fails at once and names the module", async () => {
  const page = pageThatFails({
    responses: [{ path: STAGESHOW_SCENE, status: 500 }],
  })
  await assert.rejects(
    openScreen(browserWith(page), STATE, LANDING, { width: 1440 }),
    (error) => {
      assert.match(error.message, /^landing step 1 /)
      assert.match(
        error.message,
        /the web server answered 500 for \/src\/features\/landing\/figures\/phone\/apply-scene\.tsx/
      )
      assert.match(error.message, /web log \/scratch\/ocv-ui\/1-demo\/web\.log/)
      assert.match(error.message, /run pnpm install/)
      return true
    }
  )
})

test("an uncaught page error fails the step at once and names the error", async () => {
  const page = pageThatFails({
    pageError:
      "Failed to fetch dynamically imported module: /src/features/paper/rich-page.tsx",
  })
  await assert.rejects(
    openScreen(browserWith(page), STATE, LANDING, { width: 390 }),
    /landing step 1 .* failed: the page threw Failed to fetch dynamically imported module: \/src\/features\/paper\/rich-page\.tsx/
  )
})

test("a step that times out after modules load and an api call fails still reports its own timeout", async () => {
  const page = pageThatFails({
    responses: [
      { path: STAGESHOW_SCENE, status: 200 },
      { path: "/api/paper/list", status: 500 },
      { origin: STATE.apiOrigin, path: "/src/index.ts", status: 500 },
    ],
  })
  await assert.rejects(
    openScreen(browserWith(page), STATE, LANDING, { width: 1440 }),
    /landing step 1 .* failed: Timeout 20000ms exceeded\./
  )
})
