import { spawn } from "node:child_process";

const child = spawn("npx", ["vite", "dev"], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code) => process.exit(code ?? 0));
