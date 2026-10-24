import { defineRailway, github, preserve, project, service } from "railway/iac"

// Own only application services; leave the existing Postgres and volume unmanaged.
export const partial = "opencv-apps"

// Preserve secrets and browser-origin settings; coordinate the host cutover
// using docs/deploy.md.
export default defineRailway(() => {
  const api = service("api", {
    source: github("quanvu309/opencv", { branch: "main" }),
    env: {
      PORT: "3001",
      AUTH_URL: preserve(),
      DATABASE_URL: preserve(),
      OPENROUTER_API_KEY: preserve(),
      SESSION_SECRET: preserve(),
      WEB_ORIGINS: preserve(),
    },
    build: {
      builder: "NIXPACKS",
      buildCommand:
        "pnpm install --frozen-lockfile && pnpm --filter api... run build",
      watchPatterns: [
        "apps/api/**",
        "packages/**",
        "pnpm-lock.yaml",
        "pnpm-workspace.yaml",
        "package.json",
        "turbo.json",
      ],
    },
    deploy: {
      startCommand: "pnpm --filter api run start",
      preDeployCommand: ["pnpm --filter api run migrate"],
      healthcheckPath: "/health",
      healthcheckTimeout: 120,
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 10,
    },
  })

  const web = service("web", {
    source: github("quanvu309/opencv", { branch: "main" }),
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "apps/web/Dockerfile",
      watchPatterns: [
        "apps/web/**",
        "packages/ui/**",
        "packages/domain/**",
        "pnpm-lock.yaml",
      ],
    },
    deploy: { healthcheckPath: "/health" },
    env: {
      API_UPSTREAM: "http://api.railway.internal:3001",
    },
  })

  return project("openpath", { resources: [api, web] })
})
