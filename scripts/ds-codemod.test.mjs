import assert from "node:assert/strict"
import { test } from "node:test"
import { rewriteSource } from "./ds-codemod.mjs"
import { existsSync, readFileSync } from "node:fs"
import {
  StripRefused,
  assertCodeUnchanged,
  stripComments,
} from "./lib/strip-comments.mjs"
import { bannedComments, readBaseline } from "./no-comments.mjs"

const FRESH_SHADCN_FILE = `import * as React from "react"

/**
 * Card from the registry.
 */
function Card({ className }: { className?: string }) {
  // registry note
  const open = true /* inline note */
  return (
    <div className={className}>
      {/* slot comment */}
      {open ? "open" : "closed"}
    </div>
  )
}

export { Card } // trailing note
`

const comments = (file, text) => bannedComments(file, text).length

test("a fresh shadcn file with comments has none after the codemod", () => {
  const file = "packages/ui/src/components/card.tsx"
  assert.ok(comments(file, FRESH_SHADCN_FILE) >= 5)
  const out = rewriteSource(file, FRESH_SHADCN_FILE)
  assert.equal(comments(file, out), 0)
  assert.match(out, /const open = true\n/)
  assert.match(
    out,
    /<div className=\{className\}>\n\s+\{open \? "open" : "closed"\}/
  )
  assert.match(out, /export \{ Card \}\n$/)
})

test("a css file loses its comments and keeps its rules", () => {
  const out = rewriteSource(
    "packages/ui/src/styles/extra.css",
    "/* tokens */\n:root {\n  --a: 1; /* one */\n}\n"
  )
  assert.equal(out, ":root {\n  --a: 1;\n}\n")
})

test("a file with no comment comes out unchanged", () => {
  const clean = 'export const a = "x"\n'
  assert.equal(rewriteSource("apps/web/src/a.ts", clean), clean)
})

test("directives and comment-like text inside strings survive", () => {
  const source = [
    "// eslint-disable-next-line react-hooks/exhaustive-deps -- runs once",
    "// stray",
    "export const css = `/* keep */ a { b: c }`",
    "",
  ].join("\n")
  const out = rewriteSource("packages/ui/src/components/x.tsx", source)
  assert.equal(
    out,
    [
      "// eslint-disable-next-line react-hooks/exhaustive-deps -- runs once",
      "export const css = `/* keep */ a { b: c }`",
      "",
    ].join("\n")
  )
})

test("an empty catch keeps its braces when its comment goes", () => {
  const out = rewriteSource(
    "packages/ui/src/components/x.tsx",
    "try {\n  go()\n} catch {\n  /* nicety */\n}\n"
  )
  assert.match(out, /catch \{\s*\}/)
})

test("a file the install did not touch keeps its comments", () => {
  const source = "// kept\nexport const a = 1\n"
  assert.equal(
    rewriteSource("apps/web/src/a.ts", source, () => {}, false),
    source
  )
})

test("the design-name rules still rewrite and report their hits", () => {
  const hits = []
  const out = rewriteSource(
    "apps/web/src/a.tsx",
    'const c = "duration-micro text-body"\n',
    (name) => hits.push(name)
  )
  assert.equal(out, 'const c = "duration-(--duration-micro) text-sm"\n')
  assert.equal(hits.length, 2)
})

test("MISTAKE: a string that holds the comment's own text is left whole", () => {
  const file = "packages/ui/src/components/x.ts"
  assert.equal(
    rewriteSource(file, 'const u = "// note" // note\n'),
    'const u = "// note"\n'
  )
  assert.equal(
    rewriteSource(file, "const u = '/* x */'; /* x */\n"),
    "const u = '/* x */';\n"
  )
})

test("MISTAKE: JSX text that starts with two slashes is kept as text", () => {
  const file = "packages/ui/src/components/x.tsx"
  const text = "const a = <p>// x</p>\n"
  assert.equal(rewriteSource(file, text), text)
  const lines = [
    "const a = (",
    "  <p>",
    "    // looks like one",
    "  </p>",
    ")",
    "",
  ].join("\n")
  assert.equal(rewriteSource(file, lines), lines)
})

test("comments inside CSS in a template literal go and the rules stay", () => {
  const source = [
    "export const styles = `",
    ".a {",
    "  color: red; /* why */",
    "  /* alone */",
    "  margin: 0;",
    "}",
    "`",
    "",
  ].join("\n")
  const out = rewriteSource("packages/ui/src/components/x.ts", source)
  assert.equal(
    out,
    [
      "export const styles = `",
      ".a {",
      "  color: red;",
      "  margin: 0;",
      "}",
      "`",
      "",
    ].join("\n")
  )
})

test("the strip refuses output that does not parse or whose code changed", () => {
  assert.throws(
    () =>
      assertCodeUnchanged(
        "a.tsx",
        "const a = <p>// x</p>\n",
        "const a = <p>\n"
      ),
    StripRefused
  )
  assert.throws(
    () => assertCodeUnchanged("a.ts", "const a = 1 // x\n", "const a = 2\n"),
    StripRefused
  )
  assert.throws(
    () => assertCodeUnchanged("a.ts", "f(1) // x\n", "f(1\n"),
    StripRefused
  )
  assert.doesNotThrow(() =>
    assertCodeUnchanged("a.ts", "const a = 1 // x\n", "const a = 1\n")
  )
})

test("the strip changes only comments in every file the baseline still lists", () => {
  const files = Object.keys(readBaseline()).filter((file) => existsSync(file))
  assert.ok(files.length > 100)
  for (const file of files) {
    const out = stripComments(file, readFileSync(file, "utf8"))
    assert.equal(comments(file, out), 0, file)
  }
})
