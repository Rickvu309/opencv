// Screen scaffolds for the pencil `execute` tool, one per layout in 1.4 Layouts and headers.
import { resolveVariant } from "./kit.js"

const q = (s) => JSON.stringify(s)

function header(kit, kind) {
  const { variant } = resolveVariant(kit, ["header", kind])
  if (!variant || !variant.name.toLowerCase().startsWith("header/" + kind))
    throw new Error(`Header/${kind} master not found in kit.json`)
  return variant
}

// Which text slot --title and --action write to, per header master.
const TITLE_SLOT = {
  page: 0,
  list: 0,
  chat: 0,
  settings: 0,
  document: 2,
  detail: 1,
}
const ACTION_SLOT = { page: 1 }
const SUB_SLOT = { settings: 1 }

function headerLines(kit, kind, parent, varName, opts) {
  const v = header(kit, kind)
  const lines = [
    `const ${varName} = Insert(${parent}, { type: "ref", ref: ${q(v.id)} });`,
  ]
  const t = v.texts[TITLE_SLOT[kind]]
  if (opts.title && t)
    lines.push(
      `Update(${varName} + "/${t.id}", { content: ${q(opts.title)} });`
    )
  const a = v.texts[ACTION_SLOT[kind]]
  if (opts.action && a)
    lines.push(
      `Update(${varName} + "/${a.id}", { content: ${q(opts.action)} });`
    )
  const sub = v.texts[SUB_SLOT[kind]]
  if (opts.sub && sub)
    lines.push(
      `Update(${varName} + "/${sub.id}", { content: ${q(opts.sub)} });`
    )
  return lines
}

function stageLane(kit, stage) {
  const variant = kit.components
    .flatMap((c) => c.variants)
    .find((v) => v.name === `OC Stage ${stage}`)
  if (!variant)
    throw new Error(`OC Stage ${stage} master not found in kit.json`)
  return [
    `{ const lane = Insert(board, { type: "frame", name: ${q("Lane " + stage)}, width: 244, height: "fill_container", layout: "vertical", gap: 8, padding: 8, cornerRadius: 6, fill: "#FAFAFA" });`,
    `  const head = Insert(lane, { type: "frame", name: "Lane head", width: "fill_container", height: 28, padding: [0, 4], gap: 8, alignItems: "center" });`,
    `  Insert(head, { type: "ref", ref: ${q(variant.id)} });`,
    `  Insert(head, { type: "text", content: ${q(stage)}, fontFamily: "$ds-font", fontSize: 13, fontWeight: "500", fill: "$ds-text-primary" });`,
    `  Insert(head, { type: "text", content: "0", fontFamily: "$ds-font", fontSize: 13, fill: "$ds-text-tertiary" });`,
    `  lanes.push(lane); }`,
  ]
}

export const SCREEN_LAYOUTS = [
  "app",
  "board",
  "list",
  "detail",
  "document",
  "gallery",
  "chat",
  "state",
  "settings",
  "auth",
]

export function screenSnippet(kit, layout, opts = {}) {
  if (!SCREEN_LAYOUTS.includes(layout))
    throw new Error(
      `Unknown layout "${layout}". Use one of: ${SCREEN_LAYOUTS.join(", ")}`
    )
  const name = opts.name || `New ${layout} screen`
  const pos =
    opts.x != null && opts.y != null
      ? `const pos = { x: ${Number(opts.x)}, y: ${Number(opts.y)} };`
      : "const pos = FindEmptySpace({ width: 1440, height: 900, padding: 200 });"
  const S = kit.shell
  const L = [
    `// opencv screen scaffold: ${layout} (${kit.layouts[layout === "board" ? "board" : layout]?.name || layout})`,
    pos,
  ]

  if (layout === "settings") {
    L.push(
      `const scr = Copy(${q(S.settingsTemplate)}, document, { name: ${q(name)}, x: pos.x, y: pos.y });`,
      `const sid = typeof scr === "string" ? scr : scr.id;`,
      `// Copy gives the override nodes new ids, so find the column by name.`,
      `const body = (Get(sid, { depth: 4 }).descendants.${S.mainPanel}.children || []).find((c) => c.name === "Body");`,
      `const col = sid + "/" + body.children.find((c) => c.name === "Column").id;`,
      `for (const c of Get(col, { depth: 1 }).children || []) Delete(sid + "/" + c.id);`,
      ...headerLines(kit, "settings", "col", "title", opts),
      `Insert(col, { type: "frame", name: "Gap", width: 1, height: 28 });`,
      `const section = Insert(col, { type: "text", name: "Section", content: "Section", fontFamily: "$ds-font", fontSize: 13, fontWeight: "500", fill: "$ds-text-secondary" });`,
      `Insert(col, { type: "frame", name: "Gap", width: 1, height: 8 });`,
      `const card = Insert(col, { type: "frame", name: "Card", width: "fill_container", layout: "vertical", cornerRadius: 10, fill: "$ds-bg-surface", stroke: "$ds-border", strokeWidth: 0.5 });`,
      `Print("screen: " + sid + "  column: " + col + "  card: " + card + "  (add Settings row masters to card; set the active nav item)");`
    )
    return L.join("\n")
  }

  if (layout === "auth") {
    L.push(
      `const scr = Insert(document, { type: "ref", ref: ${q(S.authLayout)}, name: ${q(name)}, x: pos.x, y: pos.y });`,
      `const form = scr + "/${S.authFormSlot}";`,
      `Print("screen: " + scr + "  form slot: " + form + "  (one field per step; copy a Flow/Sign in/* master into the slot)");`
    )
    return L.join("\n")
  }

  L.push(
    `const scr = Insert(document, { type: "ref", ref: ${q(S.appShell)}, name: ${q(name)}, x: pos.x, y: pos.y });`,
    `const main = scr + "/${S.mainPanel}";`
  )

  switch (layout) {
    case "app":
      L.push(
        ...headerLines(kit, "page", "main", "hdr", opts),
        'const body = Insert(main, { type: "frame", name: "Body", width: "fill_container", height: "fill_container", layout: "vertical", gap: 16, padding: [24, 20] });',
        'Print("screen: " + scr + "  header: " + hdr + "  body: " + body);'
      )
      break
    case "board": {
      L.push(
        ...headerLines(kit, "page", "main", "hdr", opts),
        ...headerLines(kit, "toolbar", "main", "tools", opts),
        'const board = Insert(main, { type: "frame", name: "Board", width: "fill_container", height: "fill_container", gap: 8, padding: [8, 12] });',
        "const lanes = [];"
      )
      for (const st of ["Saved", "Applied", "Interview", "Offer"])
        L.push(...stageLane(kit, st))
      L.push(
        'Print("screen: " + scr + "  board: " + board + "  lanes: " + lanes.join(", ") + "  (add OC Job card refs to lanes)");'
      )
      break
    }
    case "list":
      L.push(
        'Update(main, { layout: "horizontal" });',
        'const listPane = Insert(main, { type: "frame", name: "List pane", width: 460, height: "fill_container", layout: "vertical", stroke: "$ds-border", strokeWidth: { right: 0.5 } });',
        ...headerLines(kit, "list", "listPane", "listHdr", opts),
        'const items = Insert(listPane, { type: "frame", name: "Items", width: "fill_container", layout: "vertical", padding: [4, 6] });',
        'const detail = Insert(main, { type: "frame", name: "Detail pane", width: "fill_container", height: "fill_container", layout: "vertical" });',
        ...headerLines(kit, "reading", "detail", "readHdr", opts),
        'const read = Insert(detail, { type: "frame", name: "Read pane", width: "fill_container", height: "fill_container", layout: "vertical", padding: [24, 32], gap: 16 });',
        'Print("screen: " + scr + "  items: " + items + "  read pane: " + read + "  (add Inbox row masters to items)");'
      )
      break
    case "detail":
      L.push(
        ...headerLines(kit, "detail", "main", "hdr", opts),
        'const row = Insert(main, { type: "frame", name: "Detail", width: "fill_container", height: "fill_container" });',
        'const mainCol = Insert(row, { type: "frame", name: "Main", width: "fill_container", height: "fill_container", layout: "vertical", alignItems: "center", padding: [40, 48] });',
        'const column = Insert(mainCol, { type: "frame", name: "Column", width: 720, layout: "vertical", gap: 12 });',
        'const rail = Insert(row, { type: "frame", name: "Rail", width: 288, height: "fill_container", layout: "vertical", gap: 2, padding: [16, 12], fill: "#FAFAFA", stroke: "$ds-border", strokeWidth: { left: 0.5 } });',
        'Print("screen: " + scr + "  column: " + column + "  rail: " + rail + "  (add Property masters to the rail)");'
      )
      break
    case "document":
      L.push(
        ...headerLines(kit, "document", "main", "hdr", opts),
        'const desk = Insert(main, { type: "frame", name: "Desk", width: "fill_container", height: "fill_container", layout: "vertical", alignItems: "center", padding: [32, 0], fill: "#F4F4F6", clip: true });',
        'const page = Insert(desk, { type: "frame", name: "Page", width: 560, height: 792, layout: "vertical", padding: [48, 48], gap: 6, fill: "#FFFFFF", stroke: "$ds-border", strokeWidth: 0.5 });',
        'Print("screen: " + scr + "  page: " + page + "  (stack Block/* masters in the page)");'
      )
      break
    case "gallery":
      L.push(
        ...headerLines(kit, "page", "main", "hdr", opts),
        'const body = Insert(main, { type: "frame", name: "Body", width: "fill_container", height: "fill_container", layout: "vertical", gap: 12, padding: [24, 28] });',
        'const grid = Insert(body, { type: "frame", name: "Row", gap: 24 });',
        'Print("screen: " + scr + "  body: " + body + "  row: " + grid + "  (add Section head and Gallery card masters)");'
      )
      break
    case "chat": {
      const dock = resolveVariant(kit, ["coach", "dock"]).variant
      L.push(
        ...headerLines(kit, "chat", "main", "hdr", opts),
        'const scroll = Insert(main, { type: "frame", name: "Scroll", width: "fill_container", height: "fill_container", layout: "vertical", alignItems: "center", padding: [24, 0, 0, 0] });',
        'const thread = Insert(scroll, { type: "frame", name: "Column", width: 720, layout: "vertical", gap: 16 });',
        'const dockZone = Insert(main, { type: "frame", name: "Dock zone", width: "fill_container", layout: "vertical", alignItems: "center", padding: [8, 0, 16, 0] });',
        `const dock = Insert(dockZone, { type: "ref", ref: ${q(dock.id)}, width: 720 });`,
        'Print("screen: " + scr + "  thread: " + thread + "  dock: " + dock + "  (add Message/User and Message/Coach masters)");'
      )
      break
    }
    case "state": {
      const st = resolveVariant(kit, ["state", opts.state || "empty"]).variant
      L.push(
        ...headerLines(kit, "page", "main", "hdr", opts),
        'const center = Insert(main, { type: "frame", name: "Center", width: "fill_container", height: "fill_container", justifyContent: "center", alignItems: "center" });',
        `const state = Insert(center, { type: "ref", ref: ${q(st.id)} });`,
        'Print("screen: " + scr + "  state: " + state);'
      )
      break
    }
  }
  return L.join("\n")
}
