export function fakePorts({
  files = {},
  alive = [],
  healthy = [],
  env = {},
  browser = null,
} = {}) {
  const store = new Map(Object.entries(files))
  const living = new Set(alive)
  const started = []
  const stopped = []
  let now = 0
  return {
    started,
    stopped,
    store,
    env,
    pid: 1,
    repo: "/work/opencv.worktrees/1-demo",
    scratchRoot: "/scratch/ocv-ui",
    defaultPen: "/scratch/opencv.pen",
    fs: {
      exists: (path) => store.has(path),
      read: (path) => {
        if (!store.has(path)) throw new Error(`ENOENT ${path}`)
        return store.get(path)
      },
      readOptional: (path) => store.get(path) ?? "",
      readBytes: (path) => Buffer.from(store.get(path) ?? ""),
      write: (path, data) => store.set(path, String(data)),
      mkdir: () => {},
      list: (path) => [
        ...new Set(
          [...store.keys()]
            .filter((key) => key.startsWith(`${path}/`))
            .map((key) => key.slice(path.length + 1).split("/")[0])
        ),
      ],
      claim: (path, data) => {
        if (store.has(path)) return false
        store.set(path, String(data))
        return true
      },
      remove: (path) => {
        for (const key of [...store.keys()])
          if (key === path || key.startsWith(`${path}/`)) store.delete(key)
      },
    },
    proc: {
      start: (command, args, options) => {
        const pid = 1000 + started.length
        started.push({ command, args, options, pid })
        living.add(pid)
        return pid
      },
      run: async (command, args, options) => {
        started.push({ command, args, options, pid: null })
        return 0
      },
      alive: (pid) => living.has(pid),
      stop: (pid, signal) => {
        stopped.push({ pid, signal })
        living.delete(pid)
      },
    },
    net: { isFree: async () => true },
    http: {
      get: async (url) => ({
        status: healthy.some((prefix) => url.startsWith(prefix)) ? 200 : 503,
        text: "",
        setCookie: [],
      }),
      post: async () => ({ status: 500, text: "", setCookie: [] }),
    },
    clock: {
      now: () => now,
      pause: async (ms) => {
        now += ms
      },
    },
    browser: { launch: async () => browser },
  }
}
