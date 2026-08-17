import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const src = pathToFileURL(`${process.cwd()}/src/`).href;

function resolveAlias(specifier) {
  const relative = specifier.slice(2);
  const base = new URL(relative, src);
  if (/\.(ts|tsx|js|mjs|cjs|json|md|sql)$/i.test(relative)) return base.href;
  for (const extra of [".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const candidate = new URL(relative + extra, src);
    if (existsSync(fileURLToPath(candidate))) return candidate.href;
  }
  return `${base.href}.ts`;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return nextResolve(resolveAlias(specifier), context);
    }
    return nextResolve(specifier, context);
  },
});
