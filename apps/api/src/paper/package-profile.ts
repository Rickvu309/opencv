import { WORD_NS, XMLNS_NS, type XmlElement } from "./package-xml.js"

export const MAIN_PART = "word/document.xml"
export const OFFICE_RELATIONSHIP_NS =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
export const RELATIONSHIP_NS =
  "http://schemas.openxmlformats.org/package/2006/relationships"
export const CONTENT_TYPE_NS =
  "http://schemas.openxmlformats.org/package/2006/content-types"
export const W14_NS = "http://schemas.microsoft.com/office/word/2010/wordml"
export const MC_NS =
  "http://schemas.openxmlformats.org/markup-compatibility/2006"

export const PACKAGE_PROFILE = Object.freeze({
  version: "paper-safe-surface-one-run-unique-span-2",
  propNames: new Set(
    "pPr rPr pStyle rStyle numPr numId ilvl keepNext keepLines pageBreakBefore widowControl suppressLineNumbers pBdr top left bottom right between bar shd tabs tab suppressAutoHyphens kinsoku wordWrap overflowPunct topLinePunct autoSpaceDE autoSpaceDN bidi adjustRightInd snapToGrid spacing ind contextualSpacing mirrorIndents suppressOverlap jc textDirection textAlignment outlineLvl rFonts b bCs i iCs caps smallCaps strike dstrike outline shadow emboss imprint noProof vanish webHidden color w kern position sz szCs highlight u effect bdr fitText vertAlign rtl cs em lang eastAsianLayout specVanish oMath".split(
      " "
    )
  ),
  propAttrs: new Set(
    "val before after beforeLines afterLines beforeAutospacing afterAutospacing line lineRule left right start end firstLine hanging leftChars rightChars firstLineChars hangingChars color themeColor themeTint themeShade fill themeFill themeFillTint themeFillShade sz space shadow frame w type pos leader ascii hAnsi eastAsia cs hint asciiTheme hAnsiTheme eastAsiaTheme cstheme bidi combine combineBrackets id".split(
      " "
    )
  ),
  knownSettings: new Set(
    "zoom proofState defaultTabStop characterSpacingControl footnotePr endnotePr compat rsids themeFontLang clrSchemeMapping shapeDefaults hdrShapeDefaults decimalSymbol listSeparator removePersonalInformation removeDateAndTime mirrorMargins docVars doNotAutoCompressPictures displayBackgroundShape stylePaneFormatFilter stylePaneSortMethod savePreviewPicture embedTrueTypeFonts doNotIncludeSubdocsInStats".split(
      " "
    )
  ),
  knownStoryNames: new Set(
    "background separator continuationSeparator document body p pPr r rPr t tbl tblPr tblGrid gridCol tr trPr tc tcPr sectPr headerReference footerReference type pgSz pgMar cols docGrid titlePg pgNumType textDirection bidi rtlGutter paperSrc footnotePr endnotePr lnNumType formProt noEndnote vAlign bookmarks hdr ftr footnotes footnote endnotes endnote comments comment hyperlink bookmarkStart bookmarkEnd commentRangeStart commentRangeEnd commentReference fldChar instrText fldSimple ins del delText moveFrom moveTo moveFromRangeStart moveFromRangeEnd moveToRangeStart moveToRangeEnd proofErr permStart permEnd customXmlInsRangeStart customXmlInsRangeEnd customXmlDelRangeStart customXmlDelRangeEnd customXmlMoveFromRangeStart customXmlMoveFromRangeEnd customXmlMoveToRangeStart customXmlMoveToRangeEnd sdt sdtPr sdtContent sdtEndPr dataBinding customXml customXmlPr smartTag smartTagPr smartTagType drawing pict object tab br cr sym footnoteReference endnoteReference lastRenderedPageBreak noBreakHyphen softHyphen pPrChange rPrChange sectPrChange tblPrChange trPrChange tcPrChange tblGridChange numPrChange cellIns cellDel cellMerge".split(
      " "
    )
  ),
  relationSuffix: new Set(
    "officeDocument styles settings webSettings numbering fontTable theme header footer footnotes endnotes comments customXml customXmlProps glossaryDocument image font hyperlink extended-properties custom-properties".split(
      " "
    )
  ),
  storyNamespaces: new Set([
    WORD_NS,
    OFFICE_RELATIONSHIP_NS,
    MC_NS,
    "http://schemas.openxmlformats.org/drawingml/2006/main",
    "http://schemas.openxmlformats.org/drawingml/2006/picture",
    "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing",
    "http://schemas.openxmlformats.org/officeDocument/2006/math",
    "urn:schemas-microsoft-com:vml",
    "urn:schemas-microsoft-com:office:office",
    "urn:schemas-microsoft-com:office:word",
    "http://schemas.microsoft.com/office/word/2010/wordprocessingShape",
    "http://schemas.microsoft.com/office/word/2010/wordprocessingGroup",
  ]),
})

export function isNamespaceAttribute(
  attribute: XmlElement["attributes"][number]
) {
  return attribute.uri === XMLNS_NS
}

export function storyPart(name: string) {
  return (
    /^word\/(document|header\d+|footer\d+|footnotes|endnotes|comments)\.xml$/.test(
      name
    ) || name === "word/glossary/document.xml"
  )
}

export function validParagraphId(value: string | undefined): value is string {
  return (
    value !== undefined &&
    /^[0-9a-fA-F]{8}$/.test(value) &&
    Number.parseInt(value, 16) > 0 &&
    Number.parseInt(value, 16) < 0x80000000
  )
}
