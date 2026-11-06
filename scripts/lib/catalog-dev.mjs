import { execFileSync, spawn } from "node:child_process"
import { watch } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const script = fileURLToPath(new URL("../catalog.mjs", import.meta.url))
const defaultRoot = path.resolve(path.dirname(script), "..")

export function runCatalog(mode, root = defaultRoot) {
  return execFileSync(process.execPath, [script, mode, "--root", root], {
    cwd: root,
    encoding: "utf8",
    timeout: 30_000,
    stdio: ["ignore", "pipe", "pipe"],
  })
}

export function watchCatalog(
  root,
  onResult,
  timers = { start: setTimeout, stop: clearTimeout }
) {
  let pending
  const regenerate = () => {
    timers.stop(pending)
    pending = timers.start(() => {
      try {
        onResult(null, runCatalog("generate", root))
      } catch (error) {
        onResult(error)
      }
    }, 25)
  }
  const watchers = ["packages/domain/src", "apps/api/src"].map((directory) =>
    watch(path.join(root, directory), { recursive: true }, (event, file) => {
      const name = file == null ? "" : String(file).replaceAll(path.sep, "/")
      if (name.includes("generated/")) return
      if (event === "rename" || !name) return regenerate()
      if (!/\.ts$|operations(?:\/|$)/.test(name)) return
      if (directory.startsWith("apps/") && !name.includes("operations")) return
      regenerate()
    })
  )
  let closed = false
  return () => {
    if (closed) return
    closed = true
    timers.stop(pending)
    watchers.forEach((watcher) => watcher.close())
  }
}

export async function catalogDev(command, root = defaultRoot) {
  runCatalog("check", root)
  if (!command.length)
    throw new Error("catalog dev requires a consumer command")
  let consumer
  let invalid = false
  let paused = false
  let stopping = false
  const start = () => {
    consumer = spawn(command[0], command.slice(1), {
      cwd: root,
      stdio: "inherit",
      detached: true,
    })
    consumer.on("error", (error) => {
      console.error(error.message)
      stop(1)
    })
    consumer.on("exit", (code) => {
      consumer = undefined
      if (stopping) return
      if (paused) {
        paused = false
        if (!invalid) start()
        return
      }
      stop(code ?? 1)
    })
  }
  const close = watchCatalog(root, (error) => {
    invalid = Boolean(error)
    if (error) {
      console.error(error.stderr?.toString() ?? error.message)
      if (consumer) {
        paused = true
        terminate()
      }
    } else if (!consumer) start()
  })
  const terminate = () => {
    if (!consumer) return
    try {
      process.kill(-consumer.pid, "SIGTERM")
    } catch {
      consumer.kill("SIGTERM")
    }
  }
  const stop = (code) => {
    stopping = true
    close()
    terminate()
    process.exitCode = code
  }
  process.once("SIGINT", () => stop(130))
  process.once("SIGTERM", () => stop(143))
  start()
}

export function catalogPlugin(root = defaultRoot) {
  let failure
  return {
    name: "operation-catalog",
    buildStart() {
      runCatalog("check", root)
    },
    configureServer(server) {
      runCatalog("check", root)
      const close = watchCatalog(root, (error) => {
        failure = error
        if (error)
          server.ws.send({
            type: "error",
            err: {
              message: error.stderr?.toString() ?? error.message,
              stack: "",
            },
          })
        else server.ws.send({ type: "full-reload" })
      })
      server.httpServer?.once("close", close)
      server.middlewares.use((_request, response, next) => {
        if (!failure) return next()
        response.statusCode = 503
        response.end(failure.stderr?.toString() ?? failure.message)
      })
    },
  }
}
