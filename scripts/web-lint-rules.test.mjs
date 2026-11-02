import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { createRequire } from "node:module"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const web = path.join(root, "apps/web")
const { ESLint } = createRequire(path.join(web, "package.json"))("eslint")
const eslint = new ESLint({ cwd: web })

async function messages(code, file) {
  const [result] = await eslint.lintText(code, {
    filePath: path.join(web, file),
  })
  return result.messages
    .filter((message) => message.ruleId === "no-restricted-syntax")
    .map((message) => message.message)
}

const SHELL = "src/features/app-shell/sidebar-frame.tsx"

test("a zone that opens the peek straight from onPointerEnter has no hover intent", async () => {
  const found = await messages(
    `export const a = <div onPointerEnter={(event) => { if (event.pointerType === "mouse") layout.peekEnter() }} />`,
    SHELL
  )
  assert.equal(found.length, 1)
  assert.match(found[0], /Popover or Tooltip.*useHoverIntent/)
})

test("onMouseEnter, onMouseOver and onPointerOver are refused outside the app shell too", async () => {
  for (const name of ["onMouseEnter", "onMouseOver", "onPointerOver"]) {
    const found = await messages(
      `export const a = <div ${name}={open} />`,
      "src/features/inbox/row.tsx"
    )
    assert.equal(found.length, 1, name)
  }
})

test("a hover prop is allowed in a test and in a listed list-highlight file", async () => {
  const code = `export const a = <div onMouseEnter={highlight} />`
  assert.deepEqual(await messages(code, "src/features/inbox/row.test.tsx"), [])
  assert.deepEqual(
    await messages(code, "src/features/command-palette/command-palette.tsx"),
    []
  )
})

test("useHoverIntent props spread onto an element are not refused", async () => {
  assert.deepEqual(
    await messages(
      `export const a = <div {...hover.triggerProps} />`,
      "src/features/inbox/row.tsx"
    ),
    []
  )
})

test("a region hidden with inert={hidden} can drop focus to the page body", async () => {
  const found = await messages(
    `export const a = <aside inert={hidden} />`,
    SHELL
  )
  assert.equal(found.length, 1)
  assert.match(found[0], /FocusSafeRegion/)
})

test("a static inert attribute and FocusSafeRegion are allowed", async () => {
  assert.deepEqual(
    await messages(
      `export const a = <div inert />`,
      "src/features/paper/paper-print-sheet.tsx"
    ),
    []
  )
  assert.deepEqual(
    await messages(
      `export const a = <FocusSafeRegion concealed={hidden} focusFallback={f} />`,
      SHELL
    ),
    []
  )
})

test("writing a custom property from a drag handler restyles every inheriting element", async () => {
  const found = await messages(
    `function showWidth(drag, width) { drag.frame?.style.setProperty("--sidebar-width", width + "px") }`,
    "src/features/app-shell/sidebar-resize-handle.tsx"
  )
  assert.equal(found.length, 1)
  assert.match(found[0], /style\.width or style\.transform/)
})

test("writing a custom property on the root element is refused in any feature", async () => {
  const found = await messages(
    "document.documentElement.style.setProperty(`--x`, 1)",
    "src/features/paper/anything.ts"
  )
  assert.ok(found.length >= 1)
})

test("writing a plain style property is allowed", async () => {
  assert.deepEqual(
    await messages(
      `function f(el) { el.style.setProperty("user-select", "none"); el.style.width = "10px" }`,
      "src/features/app-shell/sidebar-resize-handle.tsx"
    ),
    []
  )
})

const RAW_BRACKET = `import { useEffect } from "react"
export function useBracket(toggle) {
  useEffect(() => {
    function onKey(event) {
      if (event.key !== "[" || event.defaultPrevented) return
      toggle()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [toggle])
}`

test("a raw window keydown listener that ignores drags is refused and names useShortcut", async () => {
  const found = await messages(
    RAW_BRACKET,
    "src/features/app-shell/use-sidebar-layout.ts"
  )
  assert.equal(found.length, 1)
  assert.match(found[0], /useShortcut from @\/lib\/use-shortcut\.ts/)
})

test("document and globalThis key listeners are refused in any feature", async () => {
  for (const target of ["document", "globalThis"]) {
    for (const type of ["keydown", "keyup", "keypress"]) {
      const found = await messages(
        `${target}.addEventListener("${type}", run, true)`,
        "src/features/inbox/row.ts"
      )
      assert.equal(found.length, 1, `${target} ${type}`)
    }
  }
})

test("useShortcut, other window events and element key handlers are not refused", async () => {
  assert.deepEqual(
    await messages(
      `useShortcut({ key: "[", onPress: toggle })`,
      "src/features/app-shell/use-sidebar-layout.ts"
    ),
    []
  )
  assert.deepEqual(
    await messages(
      `window.addEventListener("resize", run)`,
      "src/features/inbox/row.ts"
    ),
    []
  )
  assert.deepEqual(
    await messages(
      `export const a = <input onKeyDown={run} />`,
      "src/features/inbox/row.tsx"
    ),
    []
  )
})

test("the shortcut hook itself and tests may attach a key listener", async () => {
  assert.deepEqual(await messages(RAW_BRACKET, "src/lib/use-shortcut.ts"), [])
  assert.deepEqual(
    await messages(RAW_BRACKET, "src/lib/use-shortcut.test.ts"),
    []
  )
})

const FEATURE = "src/features/inbox/row.tsx"
const KIT = "src/components/thing.tsx"

async function uiMessages(code, file = KIT) {
  return JSON.parse(
    execFileSync(
      "node",
      [path.join(root, "scripts/lib/lint-ui-text.mjs"), file],
      { input: code, encoding: "utf8" }
    )
  )
}

function atCommit(sha, file) {
  return execFileSync("git", ["show", `${sha}:${file}`], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  })
}

test("a Button, DropdownMenuItem or MenuItem with no action is refused", async () => {
  for (const tag of ["Button", "DropdownMenuItem", "MenuItem"]) {
    const found = await messages(
      `export const a = <${tag} type="button" aria-label="More">More</${tag}>`,
      FEATURE
    )
    assert.equal(found.length, 1, tag)
    assert.match(found[0], /has no action/)
  }
})

test("a control with an action, a link, a render target, a form or a disabled state is allowed", async () => {
  const quiet = [
    `<Button onClick={save}>Save</Button>`,
    `<DropdownMenuItem onSelect={remove}>Delete</DropdownMenuItem>`,
    `<MenuItem onClick={remove}>Delete</MenuItem>`,
    `<Button type="submit">Send</Button>`,
    `<Button href="/x">Go</Button>`,
    `<Button asChild><a href="/x">Go</a></Button>`,
    `<Button render={<a href="/x" />}>Go</Button>`,
    `<Button form="profile">Save</Button>`,
    `<Button disabled>Soon</Button>`,
    `<Button disabled={true}>Soon</Button>`,
    `<Button {...props}>Go</Button>`,
    `<DialogTrigger><Button variant="ghost">Open</Button></DialogTrigger>`,
    `<PopoverTrigger render={<Button variant="ghost" />}>Open</PopoverTrigger>`,
    `<Tooltip render={<Button variant="ghost" />} />`,
  ]
  for (const jsx of quiet) {
    assert.deepEqual(
      await messages(`export const a = ${jsx}`, FEATURE),
      [],
      jsx
    )
  }
})

test("a control that is only sometimes disabled is still refused", async () => {
  const mistakes = [
    `<Button disabled={!ready}>More</Button>`,
    `<Button disabled={false}>More</Button>`,
    `<Button disabled={pending}>More</Button>`,
  ]
  for (const jsx of mistakes) {
    const found = await messages(`export const a = ${jsx}`, FEATURE)
    assert.equal(found.length, 1, jsx)
    assert.match(found[0], /has no action/)
  }
})

test("a dead control is allowed in a test and refused in the kit", async () => {
  const code = `export const a = <Button type="button">More</Button>`
  assert.deepEqual(await messages(code, "src/features/inbox/row.test.tsx"), [])
  assert.equal((await uiMessages(code)).length, 1)
  assert.deepEqual(
    await uiMessages(`export const a = <Button onClick={run}>More</Button>`),
    []
  )
})

const TIMEOUT = ["set", "Timeout"].join("")
const INTERVAL = ["set", "Interval"].join("")
const CLEAR = ["clear", "Timeout"].join("")

function timerFixture(code) {
  return code
    .replaceAll("$TO", TIMEOUT)
    .replaceAll("$IV", INTERVAL)
    .replaceAll("$CL", CLEAR)
}

test("a timer whose handle is not stored or returned is refused", async () => {
  const mistakes = [
    `function f() { window.$TO(run, 10) }`,
    `function f() { $TO(run, 10) }`,
    `function f() { $IV(run, 10) }`,
    `function f() { globalThis.$TO(run, 10) }`,
    `function f() { self.$TO(run, 10) }`,
    `function f() { void $TO(run, 10) }`,
    `function f() { void window.$TO(run, 10) }`,
    `function f(c) { c && $TO(run, 10) }`,
    `function f(c) { c && window.$TO(run, 10) }`,
    `function f(c) { c ? $TO(run, 10) : undefined }`,
    `function f(c) { return c ? window.$TO(run, 10) : undefined }`,
    `function f() { ($TO(a, 1), $TO(b, 1)) }`,
    `function f() { $TO?.(run, 10) }`,
    `function f() { window.$TO?.(run, 10) }`,
    `function f() { window?.$TO(run, 10) }`,
    `function f(items) { items.push($TO(run, 10)) }`,
    `const wait = new Promise((resolve) => window.$TO(resolve, 10))`,
    `const wait = new Promise(function (resolve) { $TO(resolve, 10) })`,
    `const wait = () => Promise.resolve().then(() => $TO(run, 10))`,
  ]
  for (const raw of mistakes) {
    const code = timerFixture(raw)
    const found = await messages(code, "src/lib/thing.ts")
    assert.ok(found.length >= 1, code)
    assert.match(found[0], /handle is thrown away/)
  }
  for (const raw of mistakes.slice(0, 3)) {
    const code = timerFixture(raw)
    assert.ok((await uiMessages(code, "src/hooks/thing.ts")).length >= 1, code)
  }
})

test("a timer whose handle is stored or returned is allowed", async () => {
  const quiet = [
    `function f() { const timer = window.$TO(run, 10); return () => window.$CL(timer) }`,
    `function f(ref) { ref.current = $TO(run, 10) }`,
    `function f() { return window.$IV(run, 10) }`,
    `const wait = new Promise((resolve) => { timer = window.$TO(resolve, 10) })`,
    `function f() { window.$CL(timer) }`,
  ]
  for (const raw of quiet) {
    const code = timerFixture(raw)
    assert.deepEqual(await messages(code, "src/lib/thing.ts"), [], code)
  }
  assert.deepEqual(
    await messages(
      timerFixture(`function f() { window.$TO(run, 10) }`),
      "src/lib/thing.test.ts"
    ),
    []
  )
})

test("a form length limit typed as a number is refused in a feature", async () => {
  const mistakes = [
    `export const a = <Input maxLength={80} />`,
    `export const a = <Input maxLength="80" />`,
    `export const ok = (title) => title.length > 200`,
    `export const ok = (title) => title.length >= 10`,
  ]
  for (const code of mistakes) {
    const found = await messages(code, FEATURE)
    assert.equal(found.length, 1, code)
    assert.match(found[0], /@workspace\/domain/)
  }
})

test("a limit that comes from the contract, a short check and other folders are allowed", async () => {
  const quiet = [
    `export const a = <Input maxLength={TITLE_MAX} />`,
    `export const ok = (title) => title.length > TITLE_MAX`,
    `export const ok = (title) => title.length > 5`,
    `export const ok = (title) => title.length === 0`,
    `export const ok = (title) => title.length < 200`,
  ]
  for (const code of quiet) {
    assert.deepEqual(await messages(code, FEATURE), [], code)
  }
  const literal = `export const a = <Input maxLength={80} />`
  assert.deepEqual(await messages(literal, "src/lib/thing.tsx"), [])
  assert.deepEqual(
    await messages(literal, "src/features/inbox/row.test.tsx"),
    []
  )
})

test("each rule fires on the code that shipped the mistake", async () => {
  const deadMore = await messages(
    atCommit(
      "3d7183c0^",
      "apps/web/src/features/paper/paper-letter-article.tsx"
    ),
    "src/features/paper/paper-letter-article.tsx"
  )
  assert.ok(deadMore.some((message) => /has no action/.test(message)))

  const loosePalette = await messages(
    atCommit(
      "a98498ba^",
      "apps/web/src/features/command-palette/command-palette.tsx"
    ),
    "src/features/command-palette/command-palette.tsx"
  )
  assert.ok(
    loosePalette.some((message) => /handle is thrown away/.test(message))
  )

  const typedLimit = await messages(
    atCommit("70a4c349", "apps/web/src/features/landing/figures/generate.mjs"),
    "src/features/landing/figures/generate.ts"
  )
  assert.ok(typedLimit.some((message) => /@workspace\/domain/.test(message)))
})
