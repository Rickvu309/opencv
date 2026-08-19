import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const src = pathToFileURL(`${process.cwd()}/src/`).href;
const ui = pathToFileURL(`${process.cwd()}/packages/opath-ui/src/`).href;

function resolveFrom(root, relative) {
  const base = new URL(relative, root);
  if (/\.(ts|tsx|js|mjs|cjs|json|md|sql)$/i.test(relative)) return base.href;
  for (const extra of [".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const candidate = new URL(relative + extra, root);
    if (existsSync(fileURLToPath(candidate))) return candidate.href;
  }
  return `${base.href}.ts`;
}

function resolveAlias(specifier) {
  const relative = specifier.slice(2);
  if (
    relative === "ui/run-command" ||
    relative.startsWith("ui/run-command.") ||
    relative === "ui/notifications" ||
    relative.startsWith("ui/notifications.")
  ) {
    return resolveFrom(src, relative);
  }
  if (relative.startsWith("ui/")) {
    return resolveFrom(ui, relative.slice(3));
  }
  return resolveFrom(src, relative);
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return nextResolve(resolveAlias(specifier), context);
    }
    return nextResolve(specifier, context);
  },
});
