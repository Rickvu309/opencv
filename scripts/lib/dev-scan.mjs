const WEB_VITE = "apps/web/vite.config.ts"
const SOURCE =
  /["']@workspace\/paper-engine["'][\s\S]{0,240}packages\/paper-engine\/src\/index\.ts/

export function detect(text, path = "") {
  if (!path.endsWith(WEB_VITE)) return []
  const source = String(text)
  if (!source.includes("@workspace/domain")) return []
  if (SOURCE.test(source)) return []
  const line =
    source.split("\n").findIndex((row) => row.includes("@workspace/domain")) + 1
  return [
    {
      line,
      text: "@workspace/paper-engine is not aliased to its source, so the dev server skips pre-bundling and reloads a screen while it is being checked",
    },
  ]
}
