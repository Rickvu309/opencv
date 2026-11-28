export const GUARD_FIXTURES = "scripts/"

export const VIEW_FRAMEWORK_HINT =
  "the Paper core owns its view: keep ProseMirror to model, state, transform, history and collab, with no prosemirror-view, Tiptap, BlockNote or Yjs anywhere in the repo"

const BANNED =
  /^(?:prosemirror-view|yjs|y-prosemirror|y-protocols|y-indexeddb)(?:\/|$)|^@(?:tiptap|blocknote)\//

const IMPORT =
  /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)["']([^"']+)["']/gm

const lineOf = (source, index) => source.slice(0, index).split("\n").length

const inScope = (fileName) => !fileName.startsWith(GUARD_FIXTURES)

function manifestProblems(source, fileName) {
  const manifest = JSON.parse(source)
  return ["dependencies", "devDependencies", "peerDependencies"].flatMap(
    (field) =>
      Object.keys(manifest[field] ?? {})
        .filter((name) => BANNED.test(name))
        .map(
          (name) => `${fileName}: ${field} has ${name}; ${VIEW_FRAMEWORK_HINT}`
        )
  )
}

export function editorViewFrameworkProblems(source, fileName) {
  if (!inScope(fileName)) return []
  if (fileName.endsWith("package.json"))
    return manifestProblems(source, fileName)
  const problems = []
  for (const match of source.matchAll(IMPORT)) {
    if (BANNED.test(match[1])) {
      problems.push(
        `${fileName}:${lineOf(source, match.index)}: imports ${match[1]}; ${VIEW_FRAMEWORK_HINT}`
      )
    }
  }
  return problems
}
