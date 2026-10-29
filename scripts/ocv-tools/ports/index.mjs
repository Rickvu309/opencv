// realPorts wires the adapters a command uses outside tests.
import { fsAdapter } from "./fs.mjs"
import { ghAdapter } from "./gh.mjs"
import { gitAdapter } from "./git.mjs"
import { procAdapter, realRunner } from "./proc.mjs"

export function realPorts() {
  const run = realRunner()
  return {
    gh: ghAdapter(run),
    git: gitAdapter(run),
    fs: fsAdapter(),
    proc: procAdapter(run),
    clock: { now: () => Date.now() },
    env: process.env,
  }
}
