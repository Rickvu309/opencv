import { mkdir, readFile, writeFile } from "node:fs/promises"
import { createHash } from "node:crypto"
import { basename, dirname, resolve } from "node:path"

const [penPath, outputPath, sourceRevision = "unspecified"] =
  process.argv.slice(2)
if (!penPath || !outputPath) {
  throw new Error("usage: node scripts/pen-search-snapshot.mjs <pen> <out>")
}

const masters = ["za5E2", "injtH", "e8qf2B", "K7EGWZ"]
const required = new Set([...masters, "K3c4q"])
const document = JSON.parse(await readFile(resolve(penPath), "utf8"))
const penBytes = await readFile(resolve(penPath))
const found = new Map()

function visit(node, ancestors = []) {
  if (!node || typeof node !== "object") return
  const path = [...ancestors, node.id]
  if (required.has(node.id)) found.set(node.id, { node, path })
  for (const child of node.children ?? []) visit(child, path)
  for (const [id, child] of Object.entries(node.descendants ?? {})) {
    visit({ ...child, id: child.id ?? id }, path)
  }
}

visit(document)
for (const id of required) {
  if (!found.has(id)) throw new Error(`Pen node ${id} was not found`)
}
for (const id of masters) {
  if (!found.get(id).path.includes("B4iHj")) {
    throw new Error(`Pen master ${id} is outside B4iHj`)
  }
}
if (!found.get("K3c4q").path.includes("K5FuN")) {
  throw new Error("Pen proof node K3c4q is outside K5FuN")
}

function searchNode(node) {
  const icon = node.children?.find((child) => child.type === "icon")
  const text = node.children?.find((child) => child.type === "text")
  const clear = node.children?.find((child) => child.name === "Clear")
  if (!icon || !text) throw new Error(`${node.id} is not a search frame`)
  return {
    id: node.id,
    name: node.name,
    state: node.name.split("/")[1]?.toLowerCase() ?? "proof",
    geometry: {
      height: node.height,
      radius: node.cornerRadius,
      padding: node.padding,
      gap: node.gap,
      borderWidth: node.strokeWidth,
    },
    surface: { fill: node.fill, border: node.stroke ?? null },
    icon: {
      name: icon.icon,
      library: icon.library,
      width: icon.width,
      height: icon.height,
      color: icon.fill,
    },
    text: {
      content: text.content,
      color: text.fill,
      fontFamily: text.fontFamily,
      fontSize: text.fontSize,
      fontWeight: text.fontWeight,
    },
    clear: clear
      ? {
          name: clear.icon,
          width: clear.width,
          height: clear.height,
          color: clear.fill,
        }
      : null,
  }
}

const snapshot = {
  source: {
    file: basename(penPath),
    branch: "chore/350-design-kit-cli-skills",
    revision: sourceRevision,
    sha256: createHash("sha256").update(penBytes).digest("hex"),
    componentFrameId: "B4iHj",
    proofFrameId: "K5FuN",
    proofNodeId: "K3c4q",
  },
  states: Object.fromEntries(
    [...masters, "K3c4q"].map((id) => {
      const node = found.get(id).node
      return [
        id === "K3c4q" ? "integrations" : node.name.split("/")[1].toLowerCase(),
        searchNode(node),
      ]
    })
  ),
  implementation: {
    geometry: { height: 36, radius: 8, horizontalInset: 12, gap: 8 },
    tokens: {
      fill: "bg-card",
      border: "border-border",
      muted: "text-muted-foreground",
    },
    mapping: {
      mobileType: "text-base",
      desktopType: "md:text-sm",
      iconSize: 16,
      focus: "existing InputGroup focus ring",
    },
    deviations: [
      "Pen text is 13px; use the existing kit Input's stock 16px mobile and 14px desktop text scale.",
      "Pen search icon is 15px; use stock 16px kit icon size.",
      "Pen placeholder and icon colors use lighter independent palette values; use stock muted-foreground for both.",
      "Pen focus uses a 1.5px border; keep the existing InputGroup focus border and 3px ring treatment.",
    ],
  },
}

const output = resolve(outputPath)
const prettier = await import("prettier")
const options = (await prettier.resolveConfig(output)) ?? {}
await mkdir(dirname(output), { recursive: true })
await writeFile(
  output,
  await prettier.format(JSON.stringify(snapshot), {
    ...options,
    filepath: output,
  })
)
