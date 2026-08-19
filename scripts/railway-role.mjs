/** Which Railway service this process is. Shared by build and start. */

export function serviceName(value = process.env.RAILWAY_SERVICE_NAME) {
  return (value ?? "").toLowerCase();
}

export function isLabStorybook(name = process.env.RAILWAY_SERVICE_NAME) {
  const n = serviceName(name);
  return n === "opath-lab" || n === "storybook-lab" || (n.includes("storybook") && n.includes("lab"));
}

export function isProductionStorybook(name = process.env.RAILWAY_SERVICE_NAME) {
  const n = serviceName(name);
  if (isLabStorybook(n)) return false;
  return n === "opath-production" || n === "storybook-production" || n.includes("storybook");
}

export function buildScript(name = process.env.RAILWAY_SERVICE_NAME) {
  if (isLabStorybook(name)) return "build-storybook:lab";
  if (isProductionStorybook(name)) return "build-storybook";
  return "build";
}

export function startTarget(name = process.env.RAILWAY_SERVICE_NAME) {
  const n = serviceName(name);
  if (n.includes("worker")) return { kind: "npm", script: "worker" };
  if (isLabStorybook(n)) return { kind: "storybook", dir: "storybook-static-ui" };
  if (isProductionStorybook(n)) return { kind: "storybook", dir: "storybook-static" };
  return { kind: "npm", script: "start" };
}
