import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
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
  server: {
    port: 5173,
  },
})
