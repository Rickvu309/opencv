import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
import tsconfigPaths from "vite-tsconfig-paths";

function eveOrigin(): string {
  const production = process.env.EVE_NEXT_PRODUCTION_ORIGIN?.trim();
  if (production) return new URL(production).origin;
  const local = process.env.EVE_DEV_ORIGIN?.trim();
  if (local) return new URL(local).origin;
  return "http://127.0.0.1:2000";
}

const eve = eveOrigin();

/** Postgres is Node-only. A client import used to crash /paper with Buffer. */
function noPgInClient() {
  return {
    name: "no-pg-in-client",
    enforce: "pre" as const,
    resolveId(id: string, importer: string | undefined, options?: { ssr?: boolean }) {
      if (options?.ssr) return;
      const bare = id.split("?")[0];
      if (bare !== "pg" && !bare.startsWith("pg/") && bare !== "postgres-bytea") {
        return;
      }
      throw new Error(
        `pg cannot be imported in client code${importer ? ` (from ${importer})` : ""}. Use a Door (/api or createServerFn).`,
      );
    },
  };
}

export default defineConfig({
  server: {
    port: 3000,
  },
  optimizeDeps: {
    exclude: ["pg"],
  },
  ssr: {
    external: ["pg"],
  },
  plugins: [
    noPgInClient(),
    tsconfigPaths(),
    tailwindcss(),
    tanstackStart({
      srcDirectory: "src",
      router: {
        routesDirectory: "routes",
        generatedRouteTree: "./routeTree.gen.ts",
        quoteStyle: "double",
        semicolons: true,
      },
    }),
    viteReact(),
    nitro({
      routeRules: {
        "/eve/**": { proxy: `${eve}/eve/**` },
        "/.well-known/workflow/**": { proxy: `${eve}/.well-known/workflow/**` },
      },
    }),
  ],
});
