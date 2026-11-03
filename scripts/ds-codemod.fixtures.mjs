export const STRIP_CORPUS = [
  {
    file: "sample.ts",
    source: [
      "export const value = 1",
      "// line note",
      "/* block note */",
      "/**",
      " * doc note",
      " */",
      "export const other = 2",
      "",
    ].join("\n"),
  },
  {
    file: "sample.tsx",
    source: [
      "export function View() {",
      "  const open = true /* inline note */",
      "  return (",
      "    <div>",
      "      {/* slot note */}",
      '      {open ? "open" : "closed"}',
      "    </div>",
      "  )",
      "}",
      "",
    ].join("\n"),
  },
  {
    file: "sample.css",
    source: "/* tokens */\n:root {\n  --a: 1; /* one */\n}\n",
  },
  {
    file: "sample.mjs",
    source: [
      "export const kept = 1 // trailing note",
      "// eslint-disable-next-line no-console -- the script prints its result",
      "console.log(kept)",
      "// stray",
      "",
    ].join("\n"),
  },
]
