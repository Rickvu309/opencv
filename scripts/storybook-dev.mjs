import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const storybook = path.join(root, "node_modules/.bin/storybook");

console.log("Opath (Production)  http://localhost:6006");
console.log("Opath (Lab)         http://localhost:6007");

const children = [
  spawn(storybook, ["dev", "-p", "6006", "-c", ".storybook"], {
    stdio: "inherit",
    env: process.env,
    cwd: root,
  }),
  spawn(storybook, ["dev", "-p", "6007", "-c", "packages/opath-ui/.storybook"], {
    stdio: "inherit",
    env: process.env,
    cwd: root,
  }),
];

function shutdown(signal) {
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

let remaining = children.length;
for (const child of children) {
  child.on("exit", (code) => {
    remaining -= 1;
    if (code && code !== 0) {
      shutdown("SIGTERM");
      process.exit(code);
    }
    if (remaining === 0) process.exit(0);
  });
}
