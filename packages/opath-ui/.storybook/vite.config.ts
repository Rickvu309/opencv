import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { labAliases } from "./aliases.ts";

const dir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [tsconfigPaths({ ignoreConfigErrors: true }), viteReact(), tailwindcss()],
  server: {
    watch: {
      ignored: [path.resolve(dir, "../../../.cache/**")],
    },
  },
  resolve: {
    alias: labAliases,
  },
});
