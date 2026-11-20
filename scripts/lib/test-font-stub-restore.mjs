const FONTS_DEFINE = /Object\.defineProperty\(\s*document,\s*"fonts"/
const FONTS_SAVE = /Object\.getOwnPropertyDescriptor\(\s*document,\s*"fonts"/
const FONTS_DELETE = /Reflect\.deleteProperty\(\s*document,\s*"fonts"/
const FONTS_REDEFINE =
  /Object\.defineProperty\(\s*document,\s*"fonts",\s*[A-Za-z_$]/

export function isolatedTestFiles(configSource) {
  const start = configSource.indexOf("const ISOLATED_FILES = [")
  if (start < 0) return []
  const end = configSource.indexOf("]", start)
  const body = configSource.slice(start, end)
  return [...body.matchAll(/"([^"]+)"/g)].map((match) => match[1])
}

export function detectFontsStubRestore(source, path, isolatedFiles) {
  if (isolatedFiles.includes(path)) return []
  if (!FONTS_DEFINE.test(source)) return []
  const saved = FONTS_SAVE.test(source)
  const restored = FONTS_DELETE.test(source) || FONTS_REDEFINE.test(source)
  if (saved && restored) return []
  return [
    `${path}: a test that replaces document.fonts must save the live descriptor and restore it after; the shared vitest pool keeps one document between test files`,
  ]
}
