import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import test from "node:test"
import {
  SCREENS,
  pickScreens,
  restPoint,
  shotName,
  validateScreens,
  viewportFor,
} from "./screens.mjs"

test("the screen registry is valid", () => {
  assert.deepEqual(validateScreens(SCREENS), [])
})

test("the seeded Paper home captures a clean dock before any Coach action", () => {
  const paper = SCREENS.find((screen) => screen.id === "paper-home")
  assert.ok(paper)
  assert.equal(
    paper.steps.some((step) => step.click?.name === "Ask Coach"),
    false
  )
  assert.deepEqual(paper.steps.at(-1), {
    waitFor: { selector: '[data-slot="app-dock"]:not(:has([data-chat-id]))' },
  })
})

test("a screen with neither steps nor a reason, a duplicate, a bad route or an unknown step is refused", () => {
  const problems = validateScreens([
    { id: "a", route: "/a" },
    { id: "b", route: "/b", steps: [{ hover: "x" }] },
    { id: "b", route: "b", unreachable: "why" },
    { id: "C", route: "/c", steps: [], unreachable: "why" },
  ])
  assert.deepEqual(problems, [
    "a: needs steps or an unreachable reason, not both",
    'b: step {"hover":"x"} must be one of goto, click, clickIfShown, focus, fill, press, type, upload, waitFor, respond, paperDocs, paperFirstPages',
    "b: duplicate id",
    "b: route must start with /",
    "C: id must be kebab-case",
    "C: needs steps or an unreachable reason, not both",
  ])
})

test("screens are picked in the asked order and unknown ids are named", () => {
  const { found, missing } = pickScreens(SCREENS, [
    "paper-panel-open",
    "coach-home",
    "nope",
  ])
  assert.deepEqual(
    found.map((screen) => screen.id),
    ["paper-panel-open", "coach-home"]
  )
  assert.deepEqual(missing, ["nope"])
})

test("shell recipes reach a menu at both widths and a collapsed control at both widths", () => {
  const collapsed = SCREENS.find(
    (screen) => screen.id === "shell-sidebar-collapsed"
  )
  const menu = SCREENS.find((screen) => screen.id === "shell-menu-open")
  assert.equal(
    collapsed.steps.some((step) => step.click?.name === "Menu"),
    false
  )
  assert.equal(
    menu.steps.some((step) => step.click?.name === "Menu"),
    false
  )
  assert.equal(
    menu.steps.some((step) => step.clickIfShown?.name === "Menu"),
    true
  )
  assert.equal(
    menu.steps.some((step) =>
      String(step.clickIfShown?.selector ?? "").includes("account-trigger")
    ),
    true
  )
  assert.equal(collapsed.restPointer, "center")
  assert.deepEqual(restPoint(collapsed, { width: 1440, height: 900 }), {
    x: 720,
    y: 450,
  })
  assert.deepEqual(restPoint(collapsed, { width: 390, height: 844 }), {
    x: 195,
    y: 422,
  })
  assert.deepEqual(restPoint({ id: "jobs" }, { width: 1440, height: 900 }), {
    x: 0,
    y: 0,
  })
  assert.match(JSON.stringify(collapsed.steps), /sidebar-expand/)
  assert.match(JSON.stringify(collapsed.steps), /Close menu/)
  assert.match(JSON.stringify(menu.steps), /Close menu/)
  assert.match(JSON.stringify(menu.steps), /role=\\"menu\\"/)
})

test("MISTAKE: a recipe that clicks a template by its text label fires", () => {
  assert.deepEqual(
    validateScreens([
      {
        id: "paper-new-cv-selected",
        route: "/paper",
        steps: [{ click: { text: "Academic" } }],
      },
    ]),
    [
      'paper-new-cv-selected: step {"click":{"text":"Academic"}} clicks by text, which takes the first match even where a layout hides it; click by role and name',
    ]
  )
})

test("the same recipe clicking the template by role and name stays quiet", () => {
  assert.deepEqual(
    validateScreens([
      {
        id: "paper-new-cv-selected",
        route: "/paper",
        steps: [{ click: { role: "radio", name: "Academic" } }],
      },
    ]),
    []
  )
})

test("shot names and viewports are deterministic", () => {
  assert.equal(shotName("coach-home", 1440, 1), "coach-home-1440.png")
  assert.equal(shotName("coach-home", 390, 2), "coach-home-390@2x.png")
  assert.deepEqual(viewportFor(1440), { width: 1440, height: 900 })
  assert.deepEqual(viewportFor(390), { width: 390, height: 844 })
})

test("a screen's after steps clean up and are only allowed on a screen with steps", () => {
  assert.deepEqual(
    validateScreens([
      {
        id: "a",
        route: "/a",
        steps: [],
        after: [{ click: { role: "button", name: "x" } }],
      },
      { id: "b", route: "/b", unreachable: "why", after: [] },
      { id: "c", route: "/c", steps: [], after: [{ hover: "x" }] },
    ]),
    [
      "b: after must be a step list on a screen with steps",
      'c: step {"hover":"x"} must be one of goto, click, clickIfShown, focus, fill, press, type, upload, waitFor, respond, paperDocs, paperFirstPages',
    ]
  )
  for (const screen of SCREENS.filter((screen) =>
    ["Approve", "Deny"].some((decision) =>
      JSON.stringify(screen.steps ?? []).includes(`"name":"${decision}"`)
    )
  ))
    if (
      !["Approve", "Deny"].some((decision) =>
        JSON.stringify(screen.steps).includes(
          `"click":{"role":"button","name":"${decision}"}`
        )
      ) &&
      !screen.steps.some(
        (step) =>
          step.click?.selector ===
          '[data-slot="coach-panel"] button:text-is("Approve")'
      ) &&
      !JSON.stringify(screen.steps).includes('button[aria-label=\\"Stop\\"]')
    )
      assert.ok(screen.after?.length, `${screen.id} leaves an edit waiting`)
})

test("a respond step answers the named request in the tool's browser, preflight included", async () => {
  const { cannedAnswer } = await import("./capture.mjs")
  const request = (method, extra = {}) => ({
    method: () => method,
    headers: () => ({ origin: "http://localhost:5173", ...extra }),
  })
  const answer = {
    status: 429,
    headers: { "Retry-After": "661" },
    json: { message: "Too many" },
  }
  assert.deepEqual(cannedAnswer(request("POST"), answer), {
    status: 429,
    contentType: "application/json",
    headers: {
      "Access-Control-Allow-Origin": "http://localhost:5173",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Expose-Headers": "Retry-After",
      "Retry-After": "661",
    },
    body: '{"message":"Too many"}',
  })
  const preflight = cannedAnswer(
    request("OPTIONS", { "access-control-request-headers": "content-type" }),
    answer
  )
  assert.equal(preflight.status, 204)
  assert.equal(
    preflight.headers["Access-Control-Allow-Headers"],
    "content-type"
  )
})

test("every screen is its own file, and no screen is written inline", () => {
  const filed = readdirSync(new URL("./screens/", import.meta.url)).filter(
    (name) => name.endsWith(".mjs")
  )
  assert.equal(filed.length, SCREENS.length)
  assert.doesNotMatch(
    readFileSync(new URL("./screens.mjs", import.meta.url), "utf8"),
    /\bid: "/
  )
  for (const name of filed)
    assert.ok(
      SCREENS.some((screen) => `${screen.id}.mjs` === name),
      `${name} is not loaded`
    )
})
