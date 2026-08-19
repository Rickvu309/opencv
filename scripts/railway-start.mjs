import { spawnSync } from "node:child_process";
import { startTarget } from "./railway-role.mjs";

const target = startTarget();
console.log(
  `railway-start: ${target.kind === "storybook" ? `storybook ${target.dir}` : `npm run ${target.script}`} (STORYBOOK=${process.env.STORYBOOK ?? ""} RAILWAY_SERVICE_NAME=${process.env.RAILWAY_SERVICE_NAME ?? ""})`,
);
const r =
  target.kind === "storybook"
    ? spawnSync("node", ["scripts/storybook-serve.mjs", target.dir], { stdio: "inherit" })
    : spawnSync("npm", ["run", target.script], { stdio: "inherit" });
process.exit(r.status ?? 1);
