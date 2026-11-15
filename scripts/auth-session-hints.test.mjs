import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { detect } from "./lib/auth-session-hints.mjs"

const language = `export function readLanguage() {
  if (typeof sessionStorage === "undefined") return "en"
  return sessionStorage.getItem(LANGUAGE_STORAGE_KEY) === "vi" ? "vi" : "en"
}`
const email = `function readSignedOutEmail() {
  if (typeof sessionStorage === "undefined") return null
  return sessionStorage.getItem(SIGNED_OUT_EMAIL_KEY)
}`
const shell = (effect) => `function ShellOverlays() {
  useEffect(() => { ${effect} }, [])
}`
const write = "sessionStorage.setItem(SIGNED_OUT_EMAIL_KEY, email)"
const caught = (statement) => `try { ${statement} } catch { return }`

test("optional auth session hints catch denied getters and methods", () => {
  for (const mistake of [
    language,
    email,
    shell(write),
    shell(`if (typeof sessionStorage !== "undefined") ${caught(write)}`),
    shell(`${write}; ${caught("finish()")}`),
    shell(`try { ${write} } finally { finish() }`),
    shell(`try { finish() } catch { ${write} }`),
    shell(`try { finish() } finally { ${write} }`),
    `function ShellOverlays() { try { useEffect(() => { ${write} }, []) } catch { return } }`,
    shell(`try { function later() { ${write} }; later() } catch { return }`),
    `function readLanguage() { try { function later() { return sessionStorage.getItem("language") }; return later() } catch { return "en" } }`,
    `function readSignedOutEmail() { return window.sessionStorage?.getItem(SIGNED_OUT_EMAIL_KEY) }`,
    `function readLanguage() { return globalThis.sessionStorage.getItem("language") }`,
    `function readLanguage() { return window["sessionStorage"].getItem("language") }`,
  ])
    assert.notDeepEqual(detect(mistake), [], mistake)

  for (const clean of [
    `function readLanguage() { try { if (typeof sessionStorage === "undefined") return "en"; return sessionStorage.getItem("language") } catch { return "en" } }`,
    `function readSignedOutEmail() { try { return window.sessionStorage.getItem(SIGNED_OUT_EMAIL_KEY) } catch { return null } }`,
    shell(caught(write)),
    shell(`function later() { ${caught(write)} }; later()`),
    `function unrelated() { return sessionStorage.getItem("other") }`,
    `function OtherScreen() { useEffect(() => { ${write} }, []) }`,
  ])
    assert.deepEqual(detect(clean), [], clean)
})

test("each owning auth hint boundary stays protected", () => {
  for (const file of [
    "apps/web/src/features/auth/auth-copy.ts",
    "apps/web/src/lib/api.ts",
    "apps/web/src/features/auth/shell-overlays.tsx",
  ]) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8")
    assert.deepEqual(detect(source, file), [], file)
    const mistake = source.replaceAll(/catch\s*\{/g, "finally {")
    assert.notEqual(source, mistake, file)
    assert.notDeepEqual(detect(mistake, file), [], file)
  }
})
