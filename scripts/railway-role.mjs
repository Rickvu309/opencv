/** Which Railway service this process is. Shared by build and start. */

export function serviceName(value = process.env.RAILWAY_SERVICE_NAME) {
  return (value ?? "").toLowerCase();
}

export function buildScript(name = process.env.RAILWAY_SERVICE_NAME) {
  const n = serviceName(name);
  if (n.includes("storybook") && n.includes("lab")) return "build-storybook:lab";
  if (n.includes("storybook")) return "build-storybook";
  return "build";
}

export function startTarget(name = process.env.RAILWAY_SERVICE_NAME) {
  const n = serviceName(name);
  if (n.includes("worker")) return { kind: "npm", script: "worker" };
  if (n.includes("storybook") && n.includes("lab")) {
    return { kind: "storybook", dir: "storybook-static-ui" };
  }
  if (n.includes("storybook")) return { kind: "storybook", dir: "storybook-static" };
  return { kind: "npm", script: "start" };
}
