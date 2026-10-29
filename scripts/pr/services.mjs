// The one list of production services: how Railway names them, where each
// publishes the commit it serves, and which changed files make it rebuild.
// `watchPatterns` must equal the ones in .railway/railway.ts; services.test.mjs asserts it.
export const services = [
  {
    name: "api",
    context: "opencv - api",
    shaUrl: "https://api.opencv.me/health",
    parseSha: (body) => JSON.parse(body).sha,
    deepUrl: "https://api.opencv.me/health/deep",
    watchPatterns: [
      "apps/api/**",
      "packages/**",
      "pnpm-lock.yaml",
      "pnpm-workspace.yaml",
      "package.json",
      "turbo.json",
    ],
  },
  {
    name: "web",
    context: "opencv - web",
    shaUrl: "https://opencv.me/version.txt",
    parseSha: (body) => body.trim(),
    watchPatterns: [
      "apps/web/**",
      "packages/ui/**",
      "packages/domain/**",
      "pnpm-lock.yaml",
    ],
  },
]

function matchesPattern(pattern, file) {
  const source = pattern
    .split("**")
    .map((part) =>
      part.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*")
    )
    .join(".*")
  return new RegExp(`^${source}$`).test(file)
}

export function affectedServices(changedFiles) {
  return services.filter((service) =>
    changedFiles.some((file) =>
      service.watchPatterns.some((pattern) => matchesPattern(pattern, file))
    )
  )
}
