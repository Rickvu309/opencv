import { execFileSync } from "node:child_process"

export function railwayScope(service) {
  return [
    "--project",
    "opencv",
    "--service",
    service,
    "--environment",
    "production",
  ]
}

export function cli(command, args) {
  try {
    return JSON.parse(
      execFileSync(command, args, {
        encoding: "utf8",
        timeout: 30_000,
        stdio: ["ignore", "pipe", "pipe"],
      })
    )
  } catch {
    throw new Error(
      `${command} ${args[0]} failed. Check the installed CLI and its authenticated account; output withheld because it may contain secrets.`
    )
  }
}

// Newest first, as the Railway CLI returns them.
export function listDeployments(service, io) {
  return io.cli("railway", [
    "deployment",
    "list",
    ...railwayScope(service),
    "--limit",
    "20",
    "--json",
  ])
}

export async function healthStatus(origin) {
  const response = await fetch(`${origin}/health`, {
    headers: { "User-Agent": "curl/8.0 opencv-deploy-proof" },
    signal: AbortSignal.timeout(30_000),
    redirect: "error",
  })
  return response.status
}
