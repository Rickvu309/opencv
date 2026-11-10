import { PaperPackageRefusal, refuse } from "./package-errors.js"
import {
  isNamespaceAttribute,
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
      if (insideParagraph(node)) continue
      inspectStoryNode(node)
    }
  }
}

function insideParagraph(node: XmlElement) {
  let cursor: XmlElement | undefined = node
  while (cursor) {
    if (isWord(cursor, "p")) return true
    cursor = cursor.parent
  }
  return false
}

function inspectStoryNode(node: XmlElement) {
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
      ["", WORD_NS, OFFICE_RELATIONSHIP_NS, MC_NS, XML_NS].includes(item.uri) ||
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
  for (const child of descendants(node)) inspectStoryNode(child)
  checkProperties(node)
  const paraId = attribute(node, "paraId", W14_NS)
  const textId = attribute(node, "textId", W14_NS)
  if (
    (paraId !== undefined && !validParagraphId(paraId)) ||
    (textId !== undefined && (!validParagraphId(textId) || !paraId))
  )
    refuse("UNPROVEN_IDENTITY_REACH")
  if (paraId && policy.paragraphIds.get(part)?.get(paraId.toUpperCase()) !== 1)
    refuse("UNPROVEN_IDENTITY_REACH")
  if (
    [paraId, textId].some(
      (value) =>
        value !== undefined && policy.identityValues.has(value.toUpperCase())
    )
  )
    refuse("UNPROVEN_IDENTITY_REACH")
  targetDependencies(policy)(node)
  if (policy.rangeTargets.has(node)) refuse("CROSS_PARAGRAPH_RANGE_OR_FIELD")
}

const dependencyCache = new WeakMap<
  PackageReferences,
  ReturnType<typeof buildTargetDependencies>
>()

function targetDependencies(policy: PackageReferences) {
  let check = dependencyCache.get(policy)
  if (!check) {
    check = buildTargetDependencies(policy)
    dependencyCache.set(policy, check)
  }
  return check
}

function definitionIndex(
  root: XmlElement | undefined,
  local: string,
  key: string
) {
  const index = new Map<string | undefined, XmlElement[]>()
  for (const node of root?.children ?? []) {
    if (!isWord(node, local)) continue
    const id = wordAttribute(node, key)
    const matches = index.get(id) ?? []
    matches.push(node)
    index.set(id, matches)
  }
  return index
}

function buildTargetDependencies(policy: PackageReferences) {
  const styleRoot = policy.parts.get("word/styles.xml")?.root
  const styles = definitionIndex(styleRoot, "style", "styleId")
  const defaultStyle = styleRoot?.children.find(
    (item) =>
      isWord(item, "style") &&
      wordAttribute(item, "type") === "paragraph" &&
      wordAttribute(item, "default") === "1"
  )
  const defaultId = defaultStyle
    ? wordAttribute(defaultStyle, "styleId")
    : styles.has("Normal")
      ? "Normal"
      : undefined
  const defaults = styleRoot && wordChild(styleRoot, "docDefaults")
  const numbering = policy.parts.get("word/numbering.xml")?.root
  const numbers = definitionIndex(numbering, "num", "numId")
  const abstracts = definitionIndex(numbering, "abstractNum", "abstractNumId")
  const levels = new Map<XmlElement, ReturnType<typeof definitionIndex>>()
  const abstractIds = new Map<XmlElement, string | undefined>()
  const overrides = new Set<XmlElement>()
  const linked = new Set<XmlElement>()
  for (const matches of numbers.values())
    for (const node of matches) {
      const reference = wordChild(node, "abstractNumId")
      abstractIds.set(node, reference && wordAttribute(reference, "val"))
      if (node.children.some((child) => isWord(child, "lvlOverride")))
        overrides.add(node)
    }
  for (const matches of abstracts.values())
    for (const node of matches) {
      levels.set(node, definitionIndex(node, "lvl", "ilvl"))
      if (
        node.children.some(
          (child) => isWord(child, "styleLink") || isWord(child, "numStyleLink")
        )
      )
        linked.add(node)
    }
  const roots = new WeakMap<XmlElement, PaperPackageRefusal | null>()
  const resolved = new Map<string, Map<string, PaperPackageRefusal | null>>()

  function checkRoot(root: XmlElement, style = false) {
    if (roots.has(root)) {
      const error = roots.get(root)
      if (error) throw error
      return
    }
    try {
      for (const item of descendants(root)) {
        if (style && item.local.endsWith("Change")) refuse("UNPROVEN_STYLE")
        if (isWord(item, "numPr")) {
          const id = wordChild(item, "numId")
          const value = id && wordAttribute(id, "val")
          if (value === "0") continue
          const level = wordChild(item, "ilvl")
          const nums = numbers.get(value) ?? []
          if (!level || nums.length !== 1 || overrides.has(nums[0]))
            refuse("UNPROVEN_NUMBERING")
          const matches = abstracts.get(abstractIds.get(nums[0])) ?? []
          if (
            matches.length !== 1 ||
            linked.has(matches[0]) ||
            levels.get(matches[0])?.get(wordAttribute(level, "val"))?.length !==
              1
          )
            refuse("UNPROVEN_NUMBERING")
        }
        if (isWord(item, "rFonts"))
          for (const value of item.attributes.filter(
            (value) =>
              value.local.endsWith("Theme") || value.local === "cstheme"
          ))
            if (
              !/^(major|minor)(Ascii|HAnsi|EastAsia|Bidi)$/.test(value.value) ||
              !policy.parts.has("word/theme/theme1.xml")
            )
              refuse("UNPROVEN_THEME")
      }
      roots.set(root, null)
    } catch (error) {
      if (error instanceof PaperPackageRefusal) roots.set(root, error)
      throw error
    }
  }

  function checkStyle(id: string | undefined, type: string) {
    const results =
      resolved.get(type) ?? new Map<string, PaperPackageRefusal | null>()
    resolved.set(type, results)
    const trail = new Map<string, XmlElement>()
    try {
      while (id) {
        if (results.has(id)) {
          const error = results.get(id)
          if (error) throw error
          break
        }
        const matches = styles.get(id) ?? []
        if (
          matches.length !== 1 ||
          wordAttribute(matches[0], "type") !== type ||
          trail.has(id)
        )
          refuse("UNPROVEN_STYLE")
        const node = matches[0]
        trail.set(id, node)
        const base = wordChild(node, "basedOn")
        id = base && wordAttribute(base, "val")
      }
      for (const [key, node] of [...trail].reverse()) {
        checkRoot(node, true)
        results.set(key, null)
      }
    } catch (error) {
      if (error instanceof PaperPackageRefusal)
        for (const key of trail.keys())
          if (!results.has(key)) results.set(key, error)
      throw error
    }
  }

  return function check(node: XmlElement) {
    const explicit = wordChild(node, "pPr")?.children.find((item) =>
      isWord(item, "pStyle")
    )
    checkStyle(
      explicit
        ? (wordAttribute(explicit, "val") ?? refuse("UNPROVEN_STYLE"))
        : defaultId,
      "paragraph"
    )
    for (const item of descendants(node))
      if (isWord(item, "rStyle"))
        checkStyle(
          wordAttribute(item, "val") ?? refuse("UNPROVEN_STYLE"),
          "character"
        )
    checkRoot(node)
    if (defaults) checkRoot(defaults)
  }
}
