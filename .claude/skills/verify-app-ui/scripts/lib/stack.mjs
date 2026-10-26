// Starts and stops the real api (PGlite, scripted Coach) and web dev server on ports 4450 to 4459 by
// calling the verify-opencv skill's launch.sh and cleanup.sh. That skill is not modified.
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..")
const skill = join(repo, ".claude/skills/verify-opencv/scripts")
const root = join(homedir(), "tmp", "verify-app-ui", "stack")

export function startStack({ apiPort, webPort, run }) {
  // The api imports the built domain package; a fresh worktree has no dist yet.
  if (!existsSync(join(repo, "packages/domain/dist/index.js"))) {
    execFileSync("pnpm", ["--filter", "@workspace/domain", "build"], {
      cwd: repo,
      stdio: "ignore",
      timeout: 300000,
    })
  }
  const env = {
    ...process.env,
    OPENCV_VERIFY_ROOT: root,
    OPENCV_API_PORT: String(apiPort),
    OPENCV_WEB_PORT: String(webPort),
    LAUNCH_WAIT_SECONDS: "240",
  }
  try {
    execFileSync("bash", [join(skill, "launch.sh"), run], {
      env,
      cwd: repo,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 300000,
    })
  } catch (error) {
    throw new Error(
      `stack launch failed: ${String(error.stderr ?? error.message).slice(-600)}`
    )
  }
  const text = readFileSync(join(root, run, "run.env"), "utf8")
  const get = (k) => new RegExp(`^${k}=(.*)$`, "m").exec(text)?.[1]
  return {
    apiUrl: get("API_URL"),
    webUrl: get("WEB_URL"),
    logPath: join(root, run, "api.log"),
    run,
  }
}

export function stopStack(run) {
  try {
    execFileSync("bash", [join(skill, "cleanup.sh"), run], {
      env: { ...process.env, OPENCV_VERIFY_ROOT: root },
      cwd: repo,
      stdio: "ignore",
      timeout: 60000,
    })
  } catch {}
}
