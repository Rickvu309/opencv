import { refuse } from "./package-errors.js"
import {
  isNamespaceAttribute,
  MAIN_PART,
  OFFICE_RELATIONSHIP_NS,
  PACKAGE_PROFILE,
  storyPart,
  validParagraphId,
  W14_NS,
  MC_NS,
} from "./package-profile.js"
import {
  attribute,
  type PackageReferences,
  type ParsedPart,
} from "./package-references.js"
import {
  descendants,
  isWord,
  WORD_NS,
  wordAttribute,
  wordChild,
  XML_NS,
  type XmlElement,
} from "./package-xml.js"

const WP =
  "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
const WP14 =
  "http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"
const A = "http://schemas.openxmlformats.org/drawingml/2006/main"
const A14 = "http://schemas.microsoft.com/office/drawing/2010/main"

function localIdentity(
  node: XmlElement,
  item: XmlElement["attributes"][number]
) {
  if (
    item.uri === W14_NS &&
    ["paraId", "textId"].includes(item.local) &&
    (isWord(node, "p") || isWord(node, "tr"))
  )
    return true
  if (
    item.uri === WP14 &&
    ["anchorId", "editId"].includes(item.local) &&
    node.uri === WP &&
    ["anchor", "inline"].includes(node.local)
  )
    return true
  return (
    item.uri === W14_NS &&
    item.local === "anchorId" &&
    (isWord(node, "pict") || isWord(node, "object"))
  )
}

function localDrawing(node: XmlElement) {
  const parent = node.parent
  if (node.uri === WP14 && ["sizeRelH", "sizeRelV"].includes(node.local))
    return (
      parent?.uri === WP &&
      parent.local === "anchor" &&
      node.attributes.every(
        (item) =>
          isNamespaceAttribute(item) ||
          (item.uri === "" && item.local === "relativeFrom")
      ) &&
      node.children.length === 1 &&
      node.children[0].uri === WP14 &&
      node.children[0].local ===
        (node.local === "sizeRelH" ? "pctWidth" : "pctHeight")
    )
  if (node.uri === WP14 && ["pctWidth", "pctHeight"].includes(node.local))
    return (
      parent?.uri === WP14 &&
      parent.local === (node.local === "pctWidth" ? "sizeRelH" : "sizeRelV") &&
      node.children.length === 0 &&
      node.attributes.every(isNamespaceAttribute)
    )
  return (
    node.uri === A14 &&
    ["hiddenFill", "hiddenLine"].includes(node.local) &&
    parent?.uri === A &&
    parent.local === "ext" &&
    node.attributes.every(
      (item) =>
        isNamespaceAttribute(item) ||
        (!item.uri && ["w", "cap", "cmpd", "algn"].includes(item.local))
    )
  )
}

function localWord(node: XmlElement) {
  if (!isWord(node)) return false
  if (node.local === "col")
    return (
      node.parent !== null &&
      isWord(node.parent, "cols") &&
      !node.children.length &&
      node.attributes.every(
        (item) =>
          isNamespaceAttribute(item) ||
          (item.uri === WORD_NS && ["w", "space"].includes(item.local))
      )
    )
  if (node.local === "tblOverlap")
    return (
      node.parent !== null &&
      isWord(node.parent, "tblPr") &&
      !node.children.length &&
      node.attributes.every(
        (item) =>
          isNamespaceAttribute(item) ||
          (item.uri === WORD_NS && item.local === "val")
      )
    )
  if (node.local === "txbxContent")
    return (
      node.parent !== null &&
      [
        "urn:schemas-microsoft-com:vml",
        "http://schemas.microsoft.com/office/word/2010/wordprocessingShape",
      ].includes(node.parent.uri)
    )
  const parent = node.parent
  return (
    parent !== null &&
    ((isWord(parent, "sdtPr") &&
      [
        "id",
        "docPartObj",
        "placeholder",
        "temporary",
        "showingPlcHdr",
      ].includes(node.local)) ||
      (isWord(parent, "docPartObj") &&
        ["docPartGallery", "docPartUnique"].includes(node.local)) ||
      (isWord(parent, "placeholder") && node.local === "docPart")) &&
    node.attributes.every(
      (item) =>
        isNamespaceAttribute(item) ||
        (item.uri === WORD_NS && item.local === "val")
    )
  )
}

export function inspectPackagePolicy(policy: PackageReferences) {
  for (const [name, part] of policy.parts) {
    if (name === "docMetadata/LabelInfo.xml") {
      const root = part.root
      if (
        root.uri !==
          "http://schemas.microsoft.com/office/2020/mipLabelMetadata" ||
        root.local !== "labelList" ||
        !root.children.every(
          (node) =>
            node.local === "label" &&
            attribute(node, "enabled") === "0" &&
            attribute(node, "removed") === "1"
        )
      )
        refuse("UNPROVEN_LABEL_POLICY")
    }
    if (
      name === "docProps/app.xml" &&
      descendants(part.root).some(
        (node) =>
          node.local === "DocSecurity" &&
          part.source.slice(node.openEnd, node.closeStart).trim() !== "0"
      )
    )
      refuse("UNPROVEN_DOCUMENT_PROTECTION")
    if (
      name === "docProps/custom.xml" &&
      descendants(part.root).some((node) =>
        node.attributes.some(
          (item) => item.local === "name" && /^MSIP_Label_/i.test(item.value)
        )
      )
    )
      refuse("UNPROVEN_LABEL_POLICY")
    if (name === "word/settings.xml")
      for (const node of part.root.children) {
        if (
          isWord(node) &&
          [
            "documentProtection",
            "trackRevisions",
            "mailMerge",
            "attachedTemplate",
          ].includes(node.local)
        )
          refuse("UNPROVEN_DOCUMENT_PROTECTION")
        if (
          isWord(node) &&
          [
            "drawingGridHorizontalSpacing",
            "displayHorizontalDrawingGridEvery",
          ].includes(node.local)
        ) {
          if (
            node.children.length ||
            node.attributes.some(
              (item) =>
                !isNamespaceAttribute(item) &&
                (item.uri !== WORD_NS || item.local !== "val")
            )
          )
            refuse("UNPROVEN_SETTINGS")
        } else if (
          !(isWord(node) && PACKAGE_PROFILE.knownSettings.has(node.local)) &&
          !(
            node.uri === W14_NS &&
            ["docId", "defaultImageDpi"].includes(node.local)
          ) &&
          !(
            node.uri ===
              "http://schemas.microsoft.com/office/word/2012/wordml" &&
            ["docId", "chartTrackingRefBased"].includes(node.local)
          ) &&
          !(
            node.uri ===
              "http://schemas.openxmlformats.org/officeDocument/2006/math" &&
            node.local === "mathPr"
          )
        )
          refuse("UNPROVEN_SETTINGS")
      }
    if (name === "word/fontTable.xml")
      for (const node of descendants(part.root)) {
        if (
          isWord(node) &&
          [
            "embedRegular",
            "embedBold",
            "embedItalic",
            "embedBoldItalic",
          ].includes(node.local) &&
          !policy.graph.some(
            (item) =>
              item.owner === name &&
              item.id === attribute(node, "id", OFFICE_RELATIONSHIP_NS) &&
              item.type === `${OFFICE_RELATIONSHIP_NS}/font` &&
              item.mode === "Internal"
          )
        )
          refuse("UNPROVEN_FONT_REFERENCE")
      }
    if (!storyPart(name)) continue
    for (const node of descendants(part.root)) {
      if (
        node.uri !== WORD_NS &&
        !PACKAGE_PROFILE.storyNamespaces.has(node.uri) &&
        !localDrawing(node)
      )
        refuse("UNPROVEN_EXTENSION_REACH")
      if (
        node.uri === A &&
        ["fld", "hlinkClick", "hlinkHover"].includes(node.local)
      )
        refuse("UNPROVEN_FIELD_CONSUMER")
      for (const item of node.attributes) {
        if (
          isNamespaceAttribute(item) ||
          ["", WORD_NS, OFFICE_RELATIONSHIP_NS, MC_NS, XML_NS].includes(
            item.uri
          ) ||
          localDrawing(node)
        )
          continue
        if (localIdentity(node, item)) {
          if (!validParagraphId(item.value)) refuse("UNPROVEN_IDENTITY_REACH")
        } else refuse("UNPROVEN_EXTENSION_REACH")
      }
      if (
        isWord(node) &&
        !PACKAGE_PROFILE.knownStoryNames.has(node.local) &&
        !PACKAGE_PROFILE.propNames.has(node.local) &&
        !localWord(node) &&
        ![
          "tblW",
          "tblInd",
          "tblBorders",
          "tcW",
          "tcBorders",
          "tcMar",
          "gridSpan",
          "vMerge",
          "tblLayout",
          "tblLook",
          "trHeight",
          "cantSplit",
          "tblCellMar",
        ].includes(node.local)
      )
        refuse("UNPROVEN_STORY_CONSUMER")
    }
  }
}

function checkProperties(root: XmlElement) {
  for (const node of descendants(root)) {
    if (node === root || isWord(node, "r") || isWord(node, "t")) {
      for (const item of node.attributes) {
        if (
          isNamespaceAttribute(item) ||
          (node === root &&
            item.uri === W14_NS &&
            ["paraId", "textId"].includes(item.local)) ||
          ((node === root || isWord(node, "r")) &&
            item.uri === WORD_NS &&
            /^rsid(R|RPr|RDefault|P|Del)$/.test(item.local)) ||
          (isWord(node, "t") &&
            item.uri === XML_NS &&
            item.local === "space" &&
            ["default", "preserve"].includes(item.value))
        )
          continue
        refuse("UNSUPPORTED_TARGET_ATTRIBUTE")
      }
      continue
    }
    if (
      !isWord(node) ||
      !PACKAGE_PROFILE.propNames.has(node.local) ||
      node.attributes.some(
        (item) =>
          !isNamespaceAttribute(item) &&
          (item.uri !== WORD_NS || !PACKAGE_PROFILE.propAttrs.has(item.local))
      )
    )
      refuse("UNSUPPORTED_TARGET_PROPERTY")
  }
}

export function inspectTargetPolicy(
  node: XmlElement,
  part: ParsedPart,
  policy: PackageReferences
) {
  checkProperties(node)
  const paraId = attribute(node, "paraId", W14_NS)
  const textId = attribute(node, "textId", W14_NS)
  if (
    (paraId !== undefined && !validParagraphId(paraId)) ||
    (textId !== undefined && (!validParagraphId(textId) || !paraId))
  )
    refuse("UNPROVEN_IDENTITY_REACH")
  if (
    paraId &&
    descendants(part.root).filter(
      (item) =>
        isWord(item, "p") &&
        attribute(item, "paraId", W14_NS)?.toUpperCase() ===
          paraId.toUpperCase()
    ).length !== 1
  )
    refuse("UNPROVEN_IDENTITY_REACH")
  if (
    policy.identityReferences.some((item) =>
      [paraId?.toUpperCase(), textId?.toUpperCase()].includes(
        item.value.toUpperCase()
      )
    )
  )
    refuse("UNPROVEN_IDENTITY_REACH")
  const styleRoot = policy.parts.get("word/styles.xml")?.root
  const definitions =
    styleRoot?.children.filter((item) => isWord(item, "style")) ?? []
  const closure = [node]
  const visiting = new Set<string>()
  function visit(id: string | undefined, type: string) {
    if (!id) return
    const matches = definitions.filter(
      (item) => wordAttribute(item, "styleId") === id
    )
    if (
      matches.length !== 1 ||
      wordAttribute(matches[0], "type") !== type ||
      visiting.has(`${type}:${id}`)
    )
      refuse("UNPROVEN_STYLE")
    const style = matches[0]
    visiting.add(`${type}:${id}`)
    closure.push(style)
    const base = wordChild(style, "basedOn")
    visit(base && wordAttribute(base, "val"), type)
    if (descendants(style).some((item) => item.local.endsWith("Change")))
      refuse("UNPROVEN_STYLE")
    visiting.delete(`${type}:${id}`)
  }
  const defaultStyle = definitions.find(
    (item) =>
      wordAttribute(item, "type") === "paragraph" &&
      wordAttribute(item, "default") === "1"
  )
  const explicit = wordChild(node, "pPr")?.children.find((item) =>
    isWord(item, "pStyle")
  )
  visit(
    explicit
      ? (wordAttribute(explicit, "val") ?? refuse("UNPROVEN_STYLE"))
      : defaultStyle
        ? wordAttribute(defaultStyle, "styleId")
        : definitions.some(
              (item) => wordAttribute(item, "styleId") === "Normal"
            )
          ? "Normal"
          : undefined,
    "paragraph"
  )
  for (const item of descendants(node))
    if (isWord(item, "rStyle"))
      visit(wordAttribute(item, "val") ?? refuse("UNPROVEN_STYLE"), "character")
  const defaults = styleRoot && wordChild(styleRoot, "docDefaults")
  if (defaults) closure.push(defaults)
  for (const item of closure.flatMap(descendants)) {
    if (isWord(item, "numPr")) {
      const id = wordChild(item, "numId")
      if (id && wordAttribute(id, "val") === "0") continue
      const level = wordChild(item, "ilvl")
      const numbering = policy.parts.get("word/numbering.xml")?.root
      const nums =
        numbering?.children.filter(
          (num) =>
            isWord(num, "num") &&
            wordAttribute(num, "numId") === (id && wordAttribute(id, "val"))
        ) ?? []
      if (
        !level ||
        nums.length !== 1 ||
        nums[0].children.some((child) => isWord(child, "lvlOverride"))
      )
        refuse("UNPROVEN_NUMBERING")
      const abstractId = wordChild(nums[0], "abstractNumId")
      const abstract =
        numbering?.children.filter(
          (child) =>
            isWord(child, "abstractNum") &&
            wordAttribute(child, "abstractNumId") ===
              (abstractId && wordAttribute(abstractId, "val"))
        ) ?? []
      if (
        abstract.length !== 1 ||
        abstract[0].children.some(
          (child) => isWord(child, "styleLink") || isWord(child, "numStyleLink")
        ) ||
        abstract[0].children.filter(
          (child) =>
            isWord(child, "lvl") &&
            wordAttribute(child, "ilvl") === wordAttribute(level, "val")
        ).length !== 1
      )
        refuse("UNPROVEN_NUMBERING")
    }
    if (isWord(item, "rFonts"))
      for (const value of item.attributes.filter(
        (value) => value.local.endsWith("Theme") || value.local === "cstheme"
      )) {
        if (
          !/^(major|minor)(Ascii|HAnsi|EastAsia|Bidi)$/.test(value.value) ||
          !policy.parts.has("word/theme/theme1.xml")
        )
          refuse("UNPROVEN_THEME")
      }
  }
  if (
    policy.ranges.some(
      (range) =>
        range.part === MAIN_PART &&
        range.start < node.end &&
        range.end > node.start
    )
  )
    refuse("CROSS_PARAGRAPH_RANGE_OR_FIELD")
}
