import { spawnSync } from "node:child_process";

const r = spawnSync("npm", ["run", "build"], { stdio: "inherit" });
process.exit(r.status ?? 1);
