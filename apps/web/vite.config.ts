import path from "path"
import { mkdirSync, realpathSync, writeFileSync } from "node:fs"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"
import { catalogPlugin } from "../../scripts/lib/catalog-dev.mjs"

import { domainEntryAliases } from "./domain-entries"
import { applyLocalApiUrl } from "./local-env"
import { caddyRedirects, resolveWebOrigins } from "./src/lib/web-origins"

export default defineConfig(({ mode }) => {
  const { webPort } = applyLocalApiUrl(mode)
  const env = loadEnv(mode, path.resolve(__dirname, "../.."), "VITE_")
  const origins = resolveWebOrigins({
    publicOrigin: env.VITE_PUBLIC_ORIGIN,
    appOrigin: env.VITE_APP_ORIGIN,
  })
  return {
    plugins: [
      catalogPlugin(),
      react(),
      tailwindcss(),
      {
        name: "web-origin-routing",
        apply: "build",
        writeBundle() {
          const output = path.resolve(__dirname, ".generated")
          mkdirSync(output, { recursive: true })
          writeFileSync(
            path.join(output, "host-routing.caddy"),
            caddyRedirects(origins)
          )
        },
      },
    ],
    resolve: {
      alias: {
        "@workspace/domain/internal/paper-presentation": path.resolve(
          __dirname,
          "../../packages/domain/src/paper-doc/paper-presentation.ts"
        ),
        "@": path.resolve(__dirname, "./src"),
        ...domainEntryAliases(__dirname),
        "@workspace/paper-crdt": path.resolve(
          __dirname,
          "../../packages/paper-crdt/src/index.ts"
        ),
        "@workspace/paper-engine": path.resolve(
          __dirname,
          "../../packages/paper-engine/src/index.ts"
        ),
      },
    },
    envDir: path.resolve(__dirname, "../.."),
    server: {
      port: webPort,
      fs: {
        allow: [
          path.resolve(__dirname, "../.."),
          realpathSync(path.resolve(__dirname, "../../node_modules/.pnpm")),
        ],
      },
      allowedHosts:
        origins.kind === "split"
          ? [...origins.publicHosts, origins.appHost]
          : [],
    },
  }
})
