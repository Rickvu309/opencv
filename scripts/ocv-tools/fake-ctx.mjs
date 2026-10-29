// Test helper: a fake gh/git runner plus in-memory files. Each rule is [substring, result].
// The first rule whose substring is in "cmd args" wins; unmatched calls fail loudly.
export const NOW = Date.parse("2026-10-29T12:00:00Z")

export function fakeCtx(rules, { files = {}, env = {} } = {}) {
  const calls = []
  const written = {}
  return {
    calls,
    written,
    env,
    now: () => NOW,
    nodeVersion: "v22.1.0",
    readFile: (path) => {
      if (path in written) return written[path]
      if (path in files) return files[path]
      throw new Error(`ENOENT ${path}`)
    },
    writeFile: (path, text) => {
      written[path] = text
    },
    writeScratch: (name, text) => {
      written[name] = text
      return `/tmp/${name}`
    },
    run(cmd, args) {
      const line = `${cmd} ${args.join(" ")}`
      calls.push(line)
      for (const [match, result] of rules)
        if (line.includes(match))
          return typeof result === "function"
            ? result(line)
            : { ok: true, out: result, err: "" }
      return { ok: false, out: "", err: `unmocked: ${line}` }
    },
  }
}

export function issueData(over = {}) {
  const issue = {
    number: 90,
    title: "feat: Keep my search",
    state: "OPEN",
    body: "### Type\n\nfeat\n\n### Risk\n\nnormal\n",
    createdAt: "2026-10-01T00:00:00Z",
    lastEditedAt: null,
    labels: { nodes: [{ name: "risk:normal" }] },
    comments: { nodes: [] },
    ...over,
  }
  return JSON.stringify({
    data: { repository: { owner: { login: "owner" }, issue } },
  })
}

export const minutesAgo = (m) => new Date(NOW - m * 60000).toISOString()
