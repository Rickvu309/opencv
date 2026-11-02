import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../..")
const ui = path.join(root, "packages/ui")
const { ESLint } = createRequire(path.join(ui, "package.json"))("eslint")
const eslint = new ESLint({ cwd: ui })
const [result] = await eslint.lintText(readFileSync(0, "utf8"), {
  filePath: path.join(ui, process.argv[2]),
})
const messages = result.messages
  .filter((message) => message.ruleId === "no-restricted-syntax")
  .map((message) => message.message)
process.stdout.write(JSON.stringify(messages))
