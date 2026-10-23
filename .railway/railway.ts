import { defineRailway, github, project, service } from "railway/iac"

// AUTH_URL and WEB_ORIGINS are not declared here: the cutover flips them last,
// by hand (docs/deploy.md). api secrets stay in Railway, so api has no env.
export default defineRailway((ctx) => {
  const production = ctx.isEnvironment("production")

  const api = service("api", {
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
      VITE_API_URL: production
        ? "https://api.opencv.me"
        : "https://api-staging.opencv.me",
    },
  })

  return project("openpath", { resources: [api, web] })
})
