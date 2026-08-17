import { spawnSync } from "node:child_process";

const name = process.env.RAILWAY_SERVICE_NAME ?? "";
const isWorker = name.toLowerCase().includes("worker");
const script = isWorker ? "worker" : "start";
const r = spawnSync("npm", ["run", script], { stdio: "inherit" });
process.exit(r.status ?? 1);
