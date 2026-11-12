export const DESIGN_BRANCH = "chore/350-design-kit-cli-skills"
export const PEN_IN_BRANCH = "design/opencv.pen"
const CHILD_LIMIT = 40

export function penPath({ flag, env, fallback, exists }) {
  for (const candidate of [flag, env.OCV_PEN, fallback])
    if (candidate && exists(candidate)) return { path: candidate }
  return {
    missing: [flag, env.OCV_PEN, fallback].filter(Boolean),
    fetch: `git fetch origin ${DESIGN_BRANCH} && git show origin/${DESIGN_BRANCH}:${PEN_IN_BRANCH} > ${fallback}`,
  }
}

export function indexPen(doc) {
  const nodes = new Map()
  const visit = (node, parent) => {
    if (!node || typeof node !== "object") return
    if (typeof node.id === "string") nodes.set(node.id, { node, parent })
    for (const child of node.children ?? []) visit(child, node.id ?? parent)
  }
  for (const child of doc.children ?? []) visit(child, null)
  return nodes
}

export function findFrames(index, query) {
  if (index.has(query)) return [query]
  return [...index.entries()]
    .filter(([, { node }]) => node.name === query)
    .map(([id]) => id)
}

export function boxSides(padding) {
  if (padding === undefined) return [0, 0, 0, 0]
  if (typeof padding === "number") return [padding, padding, padding, padding]
  if (!Array.isArray(padding)) return [null, null, null, null]
  if (padding.length === 1) return boxSides(padding[0])
  if (padding.length === 2)
    return [padding[0], padding[1], padding[0], padding[1]]
  if (padding.length === 3)
    return [padding[0], padding[1], padding[2], padding[1]]
  return padding.slice(0, 4)
}

const number = (value) => (typeof value === "number" ? value : null)

export function frameGeometry(index, id) {
  const entry = index.get(id)
  if (!entry) return null
  const instance = entry.node
  const master = instance.type === "ref" ? index.get(instance.ref)?.node : null
  const node = master
    ? { ...master, ...instance, children: master.children }
    : instance
  const [paddingTop, paddingRight, paddingBottom, paddingLeft] = boxSides(
    node.padding
  )
  const children = (node.children ?? []).filter((child) => child && child.id)
  return {
    id,
    name: instance.name ?? null,
    type: instance.type,
    ref: master ? instance.ref : null,
    parent: entry.parent,
    width: number(node.width) ?? node.width ?? null,
    height: number(node.height) ?? node.height ?? null,
    x: number(instance.x),
    y: number(instance.y),
    radius: node.cornerRadius ?? 0,
    paddingTop,
    paddingRight,
    paddingBottom,
    paddingLeft,
    gap: node.gap ?? 0,
    layout: node.layout ?? "horizontal",
    children: children.slice(0, CHILD_LIMIT).map((child) => ({
      id: child.id,
      name: child.name ?? null,
      type: child.type,
      width: child.width ?? null,
      height: child.height ?? null,
    })),
    moreChildren: Math.max(0, children.length - CHILD_LIMIT),
  }
}

export function frameChain(index, id) {
  const chain = []
  for (let at = id; at && index.has(at); at = index.get(at).parent)
    chain.unshift({ id: at, node: index.get(at).node })
  return chain
}

const nodeLabel = ({ node }) =>
  node.type === "ref"
    ? `${node.name ?? node.id} (instance)`
    : (node.name ?? node.id)

const joinPath = (chain) => chain.map(nodeLabel).join(" > ")

export function framePath(index, id) {
  return joinPath(frameChain(index, id))
}

export function composedPlacement(index, { frame, composedScreen, via }) {
  const chain = frameChain(index, frame)
  if (chain.length === 0) return { inScreen: false, path: null }
  const fromScreen = (links) =>
    links.slice(links.findIndex(({ node }) => node.name === composedScreen))
  if (chain.some(({ node }) => node.name === composedScreen))
    return { inScreen: true, path: joinPath(fromScreen(chain)) }
  const instance = via ? frameChain(index, via) : []
  const master = instance.at(-1)?.node.ref
  const inMaster = chain.findIndex(({ id }) => id === master)
  if (
    instance.some(({ node }) => node.name === composedScreen) &&
    inMaster !== -1
  )
    return {
      inScreen: true,
      path: joinPath([...fromScreen(instance), ...chain.slice(inMaster + 1)]),
    }
  return { inScreen: false, path: joinPath(chain) }
}
