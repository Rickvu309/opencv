function sourceOf(sourceFrame) {
  return {
    file: "design/opencv.pen",
    branch: "chore/350-design-kit-cli-skills",
    frameId: sourceFrame.id,
    frameName: typeof sourceFrame.name === "string" ? sourceFrame.name : "",
  }
}

const EN_DASH = "\u2013"
const BANNED_CELL_TEXT = new Set(["Included", "Not included", "Coming soon"])

function fail(message) {
  throw new Error(`pricing snapshot: ${message}`)
}

function padTop(node) {
  const pad = node?.padding
  if (typeof pad === "number") return pad
  if (Array.isArray(pad) && typeof pad[0] === "number") return pad[0]
  return 0
}

function isSpacer(node) {
  return (
    node?.type === "frame" &&
    node.width === 1 &&
    typeof node.height === "number" &&
    (node.children == null || node.children.length === 0)
  )
}

function trimmed(node) {
  if (node?.type !== "text" || typeof node.content !== "string") return null
  return node.content.replaceAll("\n", " ").trim()
}

function columnOf(section) {
  const column = (section.children ?? []).find((child) => child.width === 880)
  if (!column) fail(`${section.name} has no 880 column`)
  return column
}

function sameNumber(label, values) {
  if (
    values.length === 0 ||
    values.some((value) => typeof value !== "number")
  ) {
    fail(`${label} is missing`)
  }
  const [first] = values
  if (values.some((value) => value !== first)) {
    fail(`${label} disagrees: ${values.join(", ")}`)
  }
  return first
}

function surfaceOf(fill, id) {
  if (fill && typeof fill === "object" && fill.type === "mesh_gradient") {
    return "mesh"
  }
  if (fill === "#FFFFFF") return "paper"
  fail(`${id} fill is not paper or mesh`)
}

function toneOf(fill, id) {
  if (fill === "#FFFFFF") return "white"
  if (fill === "#1B1B1F0A") return "neutral"
  fail(`${id} button fill is not white or neutral`)
}

function cellFrom(frameNode) {
  const kids = frameNode.children ?? []
  if (kids.length !== 1)
    fail(`cell ${frameNode.id} has ${kids.length} children`)
  const child = kids[0]
  if (child.type === "icon") {
    if (child.icon !== "check" || child.library !== "lucide") {
      fail(`cell ${frameNode.id} icon ${child.library}:${child.icon}`)
    }
    return { kind: "check" }
  }
  if (child.type === "text") {
    const value = trimmed(child)
    if (value === EN_DASH) return { kind: "dash" }
    if (value == null || value === "") fail(`cell ${frameNode.id} is empty`)
    if (BANNED_CELL_TEXT.has(value)) {
      fail(`cell ${frameNode.id} uses ${value}`)
    }
    return { kind: "text", value }
  }
  fail(`cell ${frameNode.id} type ${child.type}`)
}

function rowFrom(frameNode) {
  const kids = (frameNode.children ?? []).filter((child) => !isSpacer(child))
  const feature = kids.find((child) => child.type === "text")
  const cells = kids.filter((child) => child.type === "frame")
  const featureText = feature ? trimmed(feature) : ""
  if (!featureText || cells.length !== 2) fail(`row ${frameNode.id}`)
  const widths = cells.map((cell) => cell.width)
  return {
    feature: featureText,
    free: cellFrom(cells[0]),
    pro: cellFrom(cells[1]),
    valueWidth: sameNumber(`row ${frameNode.id} width`, widths),
  }
}

function directText(frameNode) {
  const texts = (frameNode.children ?? [])
    .map((child) => trimmed(child))
    .filter((value) => value)
  if (texts.length !== 1) fail(`${frameNode.id} text count ${texts.length}`)
  return texts[0]
}

function planFrom(card) {
  let name = null
  let kicker = null
  let audience = null
  let price = null
  let period = null
  let pricePx = null
  let priceTrackingPx = null
  let cta = null
  let tone = null
  let buttonPx = null
  let note = null
  let lead = null
  const features = []
  for (const child of card.children ?? []) {
    if (
      isSpacer(child) ||
      child.name === "Rule" ||
      child.type === "rectangle"
    ) {
      continue
    }
    if (child.name === "Top") {
      for (const part of child.children ?? []) {
        if (part.type === "text") name = trimmed(part)
        if (part.type === "frame") kicker = directText(part)
      }
      continue
    }
    if (child.type === "text" && audience == null) {
      audience = trimmed(child)
      continue
    }
    if (child.name === "Price") {
      const texts = (child.children ?? []).filter(
        (part) => part.type === "text"
      )
      if (texts.length !== 2) fail(`${card.id} price`)
      price = trimmed(texts[0])
      period = trimmed(texts[1])
      pricePx = texts[0].fontSize
      priceTrackingPx = texts[0].letterSpacing
      continue
    }
    if (child.name === "Button") {
      cta = directText(child)
      tone = toneOf(child.fill, child.id)
      buttonPx = child.height
      continue
    }
    if (child.name === "Helper") {
      note = directText(child)
      continue
    }
    if (child.name === "Features") {
      for (const part of child.children ?? []) {
        if (part.type === "text") {
          lead = trimmed(part)
          continue
        }
        if (part.type !== "frame") fail(`${card.id} feature ${part.id}`)
        const icon = (part.children ?? []).find((node) => node.type === "icon")
        const label = (part.children ?? [])
          .map((node) => trimmed(node))
          .find((value) => value)
        if (
          !icon ||
          icon.icon !== "check" ||
          icon.library !== "lucide" ||
          !label
        ) {
          fail(`${card.id} feature row ${part.id}`)
        }
        features.push(label)
      }
      continue
    }
    fail(`${card.name} unexpected ${child.name ?? child.type}`)
  }
  if (!name || !audience || !price || !period || !cta || !note) {
    fail(`${card.name} is incomplete`)
  }
  return {
    name,
    kicker,
    audience,
    price,
    period,
    pricePx,
    priceTrackingPx,
    cta,
    tone,
    buttonPx,
    note,
    lead,
    features,
    surface: surfaceOf(card.fill, card.id),
    shadow: card.effect?.type === "shadow",
    padPx: typeof card.padding === "number" ? card.padding : null,
    radiusPx: typeof card.cornerRadius === "number" ? card.cornerRadius : null,
  }
}

function includedItem(item) {
  const tile = (item.children ?? []).find((child) => child.name === "Tile")
  const icon = (tile?.children ?? []).find((child) => child.type === "icon")
  const texts = (item.children ?? [])
    .map((child) => trimmed(child))
    .filter((value) => value)
  if (
    !icon ||
    icon.library !== "lucide" ||
    typeof icon.icon !== "string" ||
    texts.length !== 2 ||
    tile.width !== 36
  ) {
    fail(`included item ${item.id}`)
  }
  return {
    icon: icon.icon,
    title: texts[0],
    body: texts[1],
    tilePx: tile.width,
    tileRadiusPx: tile.cornerRadius,
    iconPx: icon.width,
  }
}

function headerFrom(section) {
  const column = columnOf(section)
  const texts = (column.children ?? []).filter((child) => child.type === "text")
  if (texts.length !== 2 || column.layout !== "vertical") fail("header column")
  return {
    title: trimmed(texts[0]),
    titlePx: texts[0].fontSize,
    titleTrackingPx: texts[0].letterSpacing,
    titleLineHeight: texts[0].lineHeight,
    subhead: trimmed(texts[1]),
    subheadPx: texts[1].fontSize,
    subheadTrackingPx: texts[1].letterSpacing,
    gapPx: column.gap,
  }
}

function titleNode(column) {
  const node = (column.children ?? []).find((child) => child.type === "text")
  if (!node) fail(`${column.name} title`)
  return node
}

function compareFrom(section) {
  const column = columnOf(section)
  const kids = column.children ?? []
  let title = null
  let columns = null
  let headPx = null
  const blocks = []
  let current = null
  let seenHeader = false
  const groupPadTops = []
  const groupPadBottoms = []
  const valueWidths = []
  const rowHeights = []
  for (let index = 0; index < kids.length; index += 1) {
    const child = kids[index]
    if (isSpacer(child)) continue
    if (child.type === "text") {
      const value = trimmed(child)
      if (!seenHeader) {
        title = {
          text: value,
          fontPx: child.fontSize,
          trackingPx: child.letterSpacing,
        }
        continue
      }
      if (current) blocks.push(current)
      current = { label: value, rows: [] }
      const before = kids[index - 1]
      const after = kids[index + 1]
      if (!isSpacer(before) || !isSpacer(after)) {
        fail(`group ${value} spacing`)
      }
      groupPadTops.push(before.height)
      groupPadBottoms.push(after.height)
      continue
    }
    if (child.type === "frame" && child.height === 44) {
      seenHeader = true
      headPx = child.height
      const cells = (child.children ?? []).filter(
        (part) => part.type === "frame"
      )
      columns = cells.map((cell) => directText(cell))
      continue
    }
    if (child.type === "frame" && child.height === 48) {
      if (!current) current = { label: null, rows: [] }
      const row = rowFrom(child)
      valueWidths.push(row.valueWidth)
      rowHeights.push(child.height)
      current.rows.push({
        feature: row.feature,
        free: row.free,
        pro: row.pro,
      })
      continue
    }
    fail(`compare child ${child.id}`)
  }
  if (current) blocks.push(current)
  if (!title || !columns || columns.length !== 2) fail("compare header")
  return {
    title: title.text,
    titlePx: title.fontPx,
    titleTrackingPx: title.trackingPx,
    columns,
    blocks,
    headPx,
    rowPx: sameNumber("compare row", rowHeights),
    valuePx: sameNumber("compare value", valueWidths),
    groupPadTopPx: sameNumber("group pad top", groupPadTops),
    groupPadBottomPx: sameNumber("group pad bottom", groupPadBottoms),
  }
}

export function pricingSnapshot(sourceFrame) {
  const children = sourceFrame.children ?? []
  const sections = children.map((child) => ({
    id: child.id,
    name: child.name,
    padTop: padTop(child),
  }))
  const byName = Object.fromEntries(
    children.map((child) => [child.name, child])
  )
  for (const name of [
    "Nav",
    "Header",
    "Plans",
    "Included",
    "Compare",
    "FAQ",
    "Prefooter",
    "Footer Wrap",
  ]) {
    if (!byName[name]) fail(`missing section ${name}`)
  }

  const header = headerFrom(byName.Header)
  const planColumn = columnOf(byName.Plans)
  const cards = (planColumn.children ?? []).filter(
    (child) => child.type === "frame"
  )
  if (cards.length !== 2) fail("expected two plans")
  const free = planFrom(cards[0])
  const pro = planFrom(cards[1])
  if (
    free.surface !== "paper" ||
    free.tone !== "neutral" ||
    free.kicker != null
  ) {
    fail("free plan chrome")
  }
  if (
    pro.surface !== "mesh" ||
    pro.tone !== "white" ||
    pro.kicker == null ||
    !pro.shadow
  ) {
    fail("pro plan chrome")
  }

  const includedColumn = columnOf(byName.Included)
  const includedTitle = titleNode(includedColumn)
  const itemRow = (includedColumn.children ?? []).find(
    (child) => child.type === "frame"
  )
  const includedItems = (itemRow?.children ?? []).map(includedItem)
  if (includedItems.length !== 4) fail("included count")

  const compare = compareFrom(byName.Compare)
  const faqColumn = columnOf(byName.FAQ)
  const faqTitle = titleNode(faqColumn)
  const faqItems = []
  const faqPads = []
  for (const child of faqColumn.children ?? []) {
    if (isSpacer(child) || child.type === "text") continue
    if (child.type !== "frame") fail(`faq ${child.id}`)
    const texts = (child.children ?? [])
      .map((part) => trimmed(part))
      .filter((value) => value)
    if (texts.length !== 2) fail(`faq item ${child.id}`)
    faqItems.push({ q: texts[0], a: texts[1] })
    faqPads.push(padTop(child))
  }

  const prefooterKids = byName.Prefooter.children ?? []
  const prefooterGap = prefooterKids.find((child) => isSpacer(child))
  const blockPads = ["Included", "Compare", "FAQ"].map((name) =>
    padTop(byName[name])
  )
  const columnWidths = [
    columnOf(byName.Header).width,
    planColumn.width,
    includedColumn.width,
    columnOf(byName.Compare).width,
    faqColumn.width,
  ]
  const sectionTitlePx = sameNumber("section title", [
    includedTitle.fontSize,
    compare.titlePx,
    faqTitle.fontSize,
  ])
  const sectionTrackingPx = sameNumber("section tracking", [
    includedTitle.letterSpacing,
    compare.titleTrackingPx,
    faqTitle.letterSpacing,
  ])

  return {
    source: { ...sourceOf(sourceFrame), width: sourceFrame.width },
    sections,
    metrics: {
      columnPx: sameNumber("column", columnWidths),
      titlePx: header.titlePx,
      titleTrackingPx: header.titleTrackingPx,
      titleLineHeight: header.titleLineHeight,
      headerGapPx: header.gapPx,
      subheadPx: header.subheadPx,
      subheadTrackingPx: header.subheadTrackingPx,
      padHeaderPx: padTop(byName.Header),
      padPlansPx: padTop(byName.Plans),
      padBlockPx: sameNumber("block pad", blockPads),
      padPrefooterPx: padTop(byName.Prefooter),
      padFooterPx: padTop(byName["Footer Wrap"]),
      prefooterGapPx: prefooterGap?.height ?? null,
      plansGapPx: planColumn.gap,
      cardPadPx: sameNumber("card pad", [free.padPx, pro.padPx]),
      cardRadiusPx: sameNumber("card radius", [free.radiusPx, pro.radiusPx]),
      buttonPx: sameNumber("button", [free.buttonPx, pro.buttonPx]),
      pricePx: sameNumber("price", [free.pricePx, pro.pricePx]),
      priceTrackingPx: sameNumber("price tracking", [
        free.priceTrackingPx,
        pro.priceTrackingPx,
      ]),
      sectionTitlePx,
      sectionTrackingPx,
      faqPadPx: sameNumber("faq pad", faqPads),
      compareHeadPx: compare.headPx,
      compareRowPx: compare.rowPx,
      compareValuePx: compare.valuePx,
      compareGroupPadTopPx: compare.groupPadTopPx,
      compareGroupPadBottomPx: compare.groupPadBottomPx,
      includedGapPx: includedColumn.gap,
      includedRowGapPx: itemRow.gap,
      tilePx: sameNumber(
        "tile",
        includedItems.map((item) => item.tilePx)
      ),
      tileRadiusPx: sameNumber(
        "tile radius",
        includedItems.map((item) => item.tileRadiusPx)
      ),
      includedIconPx: sameNumber(
        "included icon",
        includedItems.map((item) => item.iconPx)
      ),
    },
    header: { title: header.title, subhead: header.subhead },
    plans: {
      free: {
        name: free.name,
        audience: free.audience,
        price: free.price,
        period: free.period,
        cta: free.cta,
        note: free.note,
        tone: free.tone,
        surface: free.surface,
        features: free.features,
      },
      pro: {
        name: pro.name,
        kicker: pro.kicker,
        kickerOnNameRow: true,
        audience: pro.audience,
        price: pro.price,
        period: pro.period,
        cta: pro.cta,
        note: pro.note,
        tone: pro.tone,
        surface: pro.surface,
        lead: pro.lead,
        features: pro.features,
      },
    },
    included: {
      title: trimmed(includedTitle),
      items: includedItems.map((item) => ({
        icon: item.icon,
        title: item.title,
        body: item.body,
      })),
    },
    compare: {
      title: compare.title,
      columns: compare.columns,
      blocks: compare.blocks,
    },
    faq: {
      title: trimmed(faqTitle),
      items: faqItems,
    },
  }
}
