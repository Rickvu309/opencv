import { spawnSync } from "node:child_process";
import { buildScript } from "./railway-role.mjs";

const script = buildScript();
console.log(`railway-build: npm run ${script} (STORYBOOK=${process.env.STORYBOOK ?? ""} RAILWAY_SERVICE_NAME=${process.env.RAILWAY_SERVICE_NAME ?? ""})`);
const r = spawnSync("npm", ["run", script], { stdio: "inherit" });
process.exit(r.status ?? 1);
