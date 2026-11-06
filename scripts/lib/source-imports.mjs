import { dirname, join, normalize } from "node:path"

const webSource = "apps/web/src"
const dynamicImport =
  /(?<![\w.$])import\(\s*["']([^"']+)["']\s*\)(?!\s*\.\s*(?!then\b|catch\b|finally\b)[A-Za-z_$])/g
const staticImport =
  /(?:^|[\n;])\s*import\s+(?!type\b)(?:[^"';]*?\s+from\s+)?["']([^"']+)["']/g

export function toRepoPath(specifier, importer) {
  if (specifier.startsWith("@/"))
    return normalize(join(webSource, specifier.slice(2)))
  if (specifier.startsWith("."))
    return normalize(join(dirname(importer), specifier))
  return null
}

function resolved(pattern, source, importer) {
  return [...source.matchAll(pattern)]
    .map((match) => toRepoPath(match[1], importer))
    .filter((path) => path !== null)
}

export function runtimeDynamicImports(source, importer) {
  return resolved(dynamicImport, source, importer)
}

export function runtimeStaticImports(source, importer) {
  return resolved(staticImport, source, importer)
}
