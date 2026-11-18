type Block = {
  id?: string
  type: string
  props?: Record<string, unknown>
  content?: unknown
  children?: Block[]
}

const LISTS = new Set(["bulletListItem", "numberedListItem"])
const LEAVES = new Set(["paperSection", "paragraph", "heading", "divider"])
const TOP_LEVEL = new Set([
  ...LISTS,
  ...LEAVES,
  "paperSkills",
  "paperExperience",
  "paperEducation",
])
const HOLDS_LISTS = new Set([...LISTS, "paperExperience", "paperEducation"])

function textOfProps(block: Block): string {
  return Object.values(block.props ?? {})
    .filter(
      (value): value is string => typeof value === "string" && value !== ""
    )
    .join(", ")
}

function asParagraph(block: Block): Block {
  const words = Array.isArray(block.content) ? block.content : []
  const content =
    words.length > 0 || textOfProps(block) === ""
      ? words
      : [{ type: "text", text: textOfProps(block), styles: {} }]
  return { id: block.id, type: "paragraph", props: {}, content, children: [] }
}

function accepts(parent: string, kid: Block): boolean {
  if (HOLDS_LISTS.has(parent)) return LISTS.has(kid.type)
  if (parent === "paperSkills") return kid.type === "paperSkillItem"
  return false
}

function cleaned(block: Block, lifted: Block[], mark: () => void): Block {
  let node = block
  if (
    !TOP_LEVEL.has(node.type) &&
    node.type !== "paperSkillItem" &&
    node.type !== "paperHeader"
  ) {
    mark()
    node = asParagraph(node)
  }
  const keep: Block[] = []
  for (const kid of node.children ?? []) {
    if (accepts(node.type, kid)) {
      keep.push(cleaned(kid, lifted, mark))
    } else {
      mark()
      const flat = cleaned(kid, lifted, mark)
      lifted.push(
        TOP_LEVEL.has(flat.type) ? flat : { ...asParagraph(flat), children: [] }
      )
    }
  }
  return { ...node, children: keep }
}

export function repairBlocks(
  kind: "cv" | "letter",
  input: readonly Block[]
): { blocks: Block[]; repaired: boolean } {
  let repaired = false
  const mark = () => {
    repaired = true
  }
  const headers =
    kind === "cv" ? input.filter((b) => b.type === "paperHeader") : []
  const body: Block[] = []
  for (const top of input) {
    if (kind === "cv" && top === headers[0]) continue
    const source =
      top.type === "paperHeader" || top.type === "paperSkillItem"
        ? asParagraph(top)
        : top
    if (source !== top) mark()
    const lifted: Block[] = []
    body.push(cleaned(source, lifted, mark), ...lifted)
  }
  if (kind !== "cv") return { blocks: body, repaired }
  const header = headers[0] ?? {
    id: "header",
    type: "paperHeader",
    props: {},
    children: [],
  }
  if (!headers[0] || input[0] !== headers[0]) mark()
  const lifted: Block[] = []
  const head = cleaned({ ...header, children: [] }, lifted, mark)
  if ((header.children ?? []).length > 0) {
    mark()
    for (const kid of header.children ?? []) {
      lifted.push(cleaned(kid, lifted, mark))
    }
  }
  return { blocks: [head, ...lifted, ...body], repaired }
}
