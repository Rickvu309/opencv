/** Which Railway service this process is. Shared by build and start. */

export function serviceName(value = process.env.RAILWAY_SERVICE_NAME) {
  return (value ?? "").toLowerCase();
}

export function storybookKind(
  name = process.env.RAILWAY_SERVICE_NAME,
  storybook = process.env.STORYBOOK,
) {
  const flag = (storybook ?? "").toLowerCase().trim();
  if (flag === "lab") return "lab";
  if (flag === "production") return "production";
  const n = serviceName(name);
  if (n === "opath-lab" || n === "storybook-lab" || (n.includes("storybook") && n.includes("lab"))) {
    return "lab";
  }
  if (n === "opath-production" || n === "storybook-production" || n.includes("storybook")) {
    return "production";
  }
  return null;
}

export function buildScript(name = process.env.RAILWAY_SERVICE_NAME) {
  const kind = storybookKind(name);
  if (kind === "lab") return "build-storybook:lab";
  if (kind === "production") return "build-storybook";
  return "build";
}

export function startTarget(name = process.env.RAILWAY_SERVICE_NAME) {
  const n = serviceName(name);
  if (n.includes("worker")) return { kind: "npm", script: "worker" };
  const gallery = storybookKind(name);
  if (gallery === "lab") return { kind: "storybook", dir: "storybook-static-ui" };
  if (gallery === "production") return { kind: "storybook", dir: "storybook-static" };
  return { kind: "npm", script: "start" };
}
