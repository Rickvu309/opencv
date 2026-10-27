import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

import { applyLocalApiUrl } from "./local-env"

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const { webPort } = applyLocalApiUrl(mode)
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@workspace/domain": path.resolve(
          __dirname,
          "../../packages/domain/src/index.ts"
        ),
      },
    },
    envDir: path.resolve(__dirname, "../.."),
    server: {
      port: webPort,
    },
  }
})
