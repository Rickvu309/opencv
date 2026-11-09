import { fsAdapter } from "./fs.mjs"
import { ghAdapter } from "./gh.mjs"
import { gitAdapter } from "./git.mjs"
import { procAdapter, realRunner } from "./proc.mjs"
import { activityAdapter } from "./activity.mjs"

export function realPorts() {
  const run = realRunner()
  return {
    gh: ghAdapter(run),
    git: gitAdapter(run),
    fs: fsAdapter(),
    proc: procAdapter(run),
    activity: activityAdapter(),
    clock: {
      now: () => Date.now(),
      pause: (seconds) =>
        Atomics.wait(
          new Int32Array(new SharedArrayBuffer(4)),
          0,
          0,
          seconds * 1000
        ),
    },
    env: process.env,
  }
}
