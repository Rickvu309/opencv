import { spawnSync } from "node:child_process";
import { buildScript } from "./railway-role.mjs";

const r = spawnSync("npm", ["run", buildScript()], { stdio: "inherit" });
process.exit(r.status ?? 1);
