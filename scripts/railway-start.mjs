import { spawnSync } from "node:child_process";
import { startTarget } from "./railway-role.mjs";

const target = startTarget();
const r =
  target.kind === "storybook"
    ? spawnSync("node", ["scripts/storybook-serve.mjs", target.dir], { stdio: "inherit" })
    : spawnSync("npm", ["run", target.script], { stdio: "inherit" });
process.exit(r.status ?? 1);
