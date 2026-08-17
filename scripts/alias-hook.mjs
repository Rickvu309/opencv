// Teaches `node --test` how this codebase writes its imports.
//
// Node strips TypeScript types natively, but it resolves modules the Node way:
// it knows nothing about tsconfig `paths`, and it will not guess an extension.
// This codebase uses both, "@/lib/..." aliases and extensionless "./types",
// so tests cannot load a single module without these two rules.
//
// Registered via --import in the `test` script.

import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = pathToFileURL(`${import.meta.dirname}/../src/`).href;
const extensions = [".ts", ".tsx", "/index.ts", "/index.tsx"];

registerHooks({
  resolve(specifier, context, nextResolve) {
    const target = specifier.startsWith("@/")
      ? new URL(specifier.slice(2), root).href
      : specifier;

    try {
      return nextResolve(target, context);
    } catch (error) {
      // Extensionless: let the tsconfig-style spelling win by trying each.
      const base =
        target.startsWith("file:") || target.startsWith(".")
          ? new URL(target, context.parentURL ?? root).href
          : null;
      if (!base) throw error;

      for (const ext of extensions) {
        if (existsSync(fileURLToPath(base + ext))) {
          return nextResolve(base + ext, context);
        }
      }
      throw error;
    }
  },
});
