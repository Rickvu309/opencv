import { defineRailway, github, preserve, project, service } from "railway/iac"

export const partial = "opencv-apps"

export default defineRailway((ctx) => {
  const production = ctx.isEnvironment("production")

  const api = service("api", {
    source: github("Rickvu309/opencv", { branch: "main" }),
    env: {
      ANTHROPIC_API_KEY: preserve(),
      AUTH_EMAIL_FROM: preserve(),
      AUTH_URL: preserve(),
      DATABASE_URL: preserve(),
      GOOGLE_CLIENT_ID: preserve(),
      GOOGLE_CLIENT_SECRET: preserve(),
      NIXPACKS_NODE_VERSION: "24",
      RESEND_API_KEY: preserve(),
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
    source: github("Rickvu309/opencv", { branch: "main" }),
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
      VITE_PUBLIC_ORIGIN: preserve(),
      VITE_APP_ORIGIN: preserve(),
    },
  })

  return project("opencv", { resources: [api, web] })
})
