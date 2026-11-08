import ts from "typescript"
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"

function redact(text) {
  return text
    .replace(
      /((?:access_token|refresh_token|code|state|code_verifier|client_secret)=)[^&\s]+/gi,
      "$1[redacted]"
    )
    .replace(/Bearer\s+[^\s"']+/gi, "Bearer [redacted]")
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: ["pipe", "pipe", "pipe"],
      detached: true,
    })
    let output = ""
    let stdout = ""
    let authenticating
    let failure
    const deadline = setTimeout(() => {
      failure = new Error(`${command} exceeded 40 seconds: ${redact(output)}`)
      process.kill(-child.pid, "SIGKILL")
    }, 40_000)
    const collect = (chunk) => {
      output = (output + String(chunk)).slice(-32_000)
      if (options.consent && !authenticating) {
        const authorization = output.match(
          /https?:\/\/[^\s<>"\u001b]+\/api\/auth\/oauth2\/authorize\?[^\s<>"\u001b]+/
        )
        if (authorization) {
          authenticating = options
            .consent(authorization[0])
            .then((callback) => {
              child.stdin.write(`${callback.href}\n`)
            })
            .catch((error) => {
              failure = error
              process.kill(-child.pid, "SIGKILL")
            })
        }
      }
    }
    child.stdout.on("data", (chunk) => {
      stdout = (stdout + String(chunk)).slice(-32_000)
      collect(chunk)
    })
    child.stderr.on("data", collect)
    child.on("error", (error) => {
      clearTimeout(deadline)
      reject(error)
    })
    child.on("close", async (code) => {
      clearTimeout(deadline)
      await authenticating
      if (failure) reject(failure)
      else if (code !== 0)
        reject(new Error(`${command} exited ${code}: ${redact(output)}`))
      else resolve(stdout)
    })
    if (!options.consent) child.stdin.end()
  })
}

export async function checkClients({
  root,
  apiRequire,
  directory,
  audience,
  person,
  authorize,
  consent,
  exercise,
}) {
  const { tsImport } = apiRequire("tsx/esm/api")
  const { agentSnippets } = await tsImport(
    resolve(root, "apps/web/src/features/connections/snippets.ts"),
    import.meta.url
  )
  const copies = new Map(
    agentSnippets(audience).flatMap((snippet) =>
      snippet.copies.map((copy) => [copy.id, copy.text])
    )
  )
  assert.equal(JSON.parse(copies.get("cursor")).mcpServers.opencv.url, audience)
  const checks = [
    {
      client: "Cursor",
      status: "static-only",
      evidence:
        "The actual connect-page JSON parses and names this MCP URL; no desktop or model run",
    },
  ]
  const inspectorPackage = resolve(
    root,
    "apps/api/node_modules/@modelcontextprotocol/inspector/package.json"
  )
  const inspector = JSON.parse(await readFile(inspectorPackage, "utf8"))
  const inspectorBin = resolve(
    dirname(inspectorPackage),
    typeof inspector.bin === "string"
      ? inspector.bin
      : inspector.bin["mcp-inspector"]
  )
  const inspectorOwner = await person("inspector@mcp-harness.example")
  const grant = await authorize(inspectorOwner)
  await grant.sdk.close()
  async function inspect(method, args = []) {
    console.error(`[mcp-harness] Inspector ${method}`)
    const output = await run(
      process.execPath,
      [
        inspectorBin,
        "--cli",
        "--client-config",
        resolve(directory, "inspector-client.json"),
        "--server-url",
        audience,
        "--transport",
        "http",
        "--protocol-era",
        "modern",
        "--connect-timeout",
        "5000",
        "--stored-auth-only",
        "--format",
        "json",
        "--method",
        method,
        ...args,
        "--header",
        `Authorization: Bearer ${grant.tokens.access_token}`,
      ],
      {
        cwd: directory,
        env: {
          MCP_CATALOG_PATH: resolve(directory, "inspector-catalog.json"),
          MCP_STORAGE_DIR: directory,
          MCP_INSPECTOR_OAUTH_STATE_PATH: resolve(
            directory,
            "inspector-oauth.json"
          ),
          MCP_INSPECTOR_SECRET_STORE: "memory",
        },
      }
    )
    const envelope = JSON.parse(output)
    assert(envelope.result, "Inspector returned a method result")
    return envelope.result
  }
  const inspectorFlow = await exercise(
    {
      listTools: () => inspect("tools/list"),
      callTool: ({ name, arguments: args }) =>
        inspect("tools/call", [
          "--tool-name",
          name,
          "--tool-args-json",
          JSON.stringify(args),
        ]),
      close: async () => {},
    },
    inspectorOwner,
    "Inspector CLI"
  )
  checks.push({
    client: `MCP Inspector ${inspector.version}`,
    flow: inspectorFlow,
    status: "passed",
    evidence:
      "Real modern CLI tools/list, read, proposal, person approval, revoke and refusal; SDK OAuth grant",
  })

  for (const name of ["codex", "claude"]) {
    let version
    try {
      version = (await run(name, ["--version"], { cwd: directory })).trim()
    } catch (error) {
      if (error.code !== "ENOENT") throw error
      checks.push({
        client: name,
        status: "skipped",
        reason: "CLI is not installed; no model command was run",
      })
      continue
    }
    const config = resolve(directory, name)
    await mkdir(config)
    const env =
      name === "codex" ? { CODEX_HOME: config } : { CLAUDE_CONFIG_DIR: config }
    const owner = await person(`${name}@mcp-harness.example`)
    const cli = (args, extra = {}) => {
      if (name === "claude" && extra.consent) {
        const shell = [name, ...args]
          .map((arg) => `'${arg.replaceAll("'", "'\\''")}'`)
          .join(" ")
        return run("script", ["-qefc", shell, "/dev/null"], {
          cwd: directory,
          env,
          ...extra,
        })
      }
      return run(name, args, { cwd: directory, env, ...extra })
    }
    if (name === "codex")
      await writeFile(resolve(config, "config.toml"), copies.get("codex-table"))
    else {
      const [command, ...args] = copies.get("claude-add").split(" ")
      assert.equal(command, name)
      await cli(args)
    }
    const [command, ...args] = copies.get(`${name}-login`).split(" ")
    assert.equal(command, name)
    let login
    try {
      login = await cli([...args, "--no-browser"], {
        consent: (url) => consent(url, owner),
      })
    } catch (error) {
      if (name !== "claude") throw error
      for (const connection of await owner.connections())
        await owner.command("connections.revoke", {
          connectionId: connection.id,
        })
      checks.push({
        client: version,
        status: "unavailable",
        reason: redact(String(error)),
        skipped:
          "Optional headless Claude login failed; no tool or model command was run",
      })
      continue
    }
    assert.match(login, /success|authenticated|logged in/i)
    assert.equal(
      (await owner.connections()).length,
      1,
      `${name} consent created one connection`
    )
    const listed = await cli([
      "mcp",
      "list",
      ...(name === "codex" ? ["--json"] : []),
    ])
    assert.match(listed, /opencv/)
    assert(listed.includes(audience), `${name} uses the connect page URL`)
    const connection = (await owner.connections())[0]
    await owner.command("connections.revoke", { connectionId: connection.id })
    checks.push({
      client: version,
      status: "passed",
      evidence:
        "Connect page configuration and login commands; discovery, person consent, token exchange and mcp list; connection revoked",
      skipped: "Tool calls require a model command; no paid calls were made",
    })
  }
  return checks
}

export function detect(text, file = "scripts/mcp-harness.mjs") {
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  )
  const hits = []
  let sdk = false
  let challenge = false
  const discovery = new Set()
  function hit(node, kind) {
    hits.push({
      line:
        source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
      kind,
    })
  }
  function visit(node) {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteralLike(node.moduleSpecifier) &&
      node.moduleSpecifier.text === "@modelcontextprotocol/client"
    )
      sdk = true
    if (ts.isCallExpression(node)) {
      if (
        node.arguments.some(
          (arg) =>
            ts.isStringLiteralLike(arg) &&
            arg.text === "@modelcontextprotocol/client"
        )
      )
        sdk = true
      const name = ts.isIdentifier(node.expression)
        ? node.expression.text
        : ts.isPropertyAccessExpression(node.expression)
          ? node.expression.name.text
          : ""
      if (
        [
          "discoverOAuthProtectedResourceMetadata",
          "discoverAuthorizationServerMetadata",
        ].includes(name)
      )
        discovery.add(name)
      if (
        name === "equal" &&
        node.arguments.some(
          (arg) => ts.isNumericLiteral(arg) && arg.text === "401"
        ) &&
        node.arguments.some(
          (arg) =>
            ts.isPropertyAccessExpression(arg) && arg.name.text === "status"
        )
      )
        challenge = true
    }
    if (
      ts.isPropertyAssignment(node) &&
      (ts.isIdentifier(node.name) || ts.isStringLiteralLike(node.name)) &&
      node.name.text === "jsonrpc"
    )
      hit(node, "raw-json-rpc")
    ts.forEachChild(node, visit)
  }
  visit(source)
  if (!sdk) hit(source, "official-sdk")
  if (!challenge || discovery.size !== 2) hit(source, "oauth-discovery")
  return hits
}
