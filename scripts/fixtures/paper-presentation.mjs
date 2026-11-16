import {
  clean as photoClean,
  mistakes as photoMistakes,
} from "./paper-photo-presentation.mjs"

export const clean = [
  ...photoClean,
  {
    path: "apps/web/src/features/paper/rich-text-emphasis-group.tsx",
    text: '<Button className="size-[44px] md:size-8" />',
  },
  {
    path: "packages/paper-crdt/src/editor.ts",
    text: 'const editor = { subscribe(listener) { tiptap.on("transaction", listener) }, formatInline() { view.focus() }, formatParagraph() { view.focus() } }',
  },
  {
    path: "packages/paper-crdt/src/native-layout-formatting.ts",
    text: "if (!inlines.length) inlines.push(readMarks([]))",
  },
  {
    path: "packages/paper-crdt/src/native-formatting-render-values.ts",
    text: 'const start = Math.max(v.start ?? 0, indent?.kind === "hanging" ? indent.value : 0); const css = `text-indent:${value}`',
  },
  {
    path: "apps/api/src/paper/native-output/formatted-properties.ts",
    text: 'function fontName() { return "Arial" }',
  },
  {
    path: "apps/web/src/test/paper-api-mock.ts",
    text: "const identity = /^\\/api\\/paper\\/([^/]+)\\/document$/.exec(path); paperDocumentInfoSchema.parse(identity)",
  },
  {
    path: "apps/web/src/features/paper/rich-page.tsx",
    text: '<Button size="icon" className="size-11 md:size-8" />',
  },
  {
    path: "apps/web/src/lib/paper-sync-recovery.ts",
    text: "const open = identity.provenance.schemaRevision === 2 ? openRichPaperClient : openPaperClient; open(stored, { provenance: identity.provenance }).destroy()",
  },
  {
    path: "packages/paper-crdt/src/native-layout-flow-mount.ts",
    text: "pasteIntoFlowText(editor, event) || defaultPasteHandler({})",
  },
  {
    path: "packages/paper-crdt/src/native-layout-flow-view.ts",
    text: 'globalThis.CSS?.supports?.("column-height: 100px")',
  },
  {
    path: "packages/paper-crdt/src/editor.ts",
    text: 'import { borrowFlowDocument } from "./native-layout-flow.js"; import { mountPrivateFlow } from "./native-layout-flow-mount.js"; export function mountRichPaperEditor() {}',
  },
  {
    path: "packages/paper-crdt/src/native-layout-flow.ts",
    text: 'import { headlessLayoutSchema } from "./native-formatting-headless.js"',
  },
  {
    path: "apps/web/vite.config.ts",
    text: 'const alias = { "@workspace/domain/internal/paper-presentation": path.resolve("packages/domain/src/paper-presentation.ts"), "@workspace/domain": path.resolve("packages/domain/src/index.ts") }',
  },
  {
    path: "packages/paper-crdt/src/stored-document.ts",
    text: 'import { createPrivateFlow, openFlowBinary, readFlow } from "./native-layout-flow.js"; export function seedStoredYDoc() {}',
  },
  {
    path: "packages/paper-crdt/src/native-layout-flow-view.ts",
    text: "Decoration.node(pos, end, { style: `height:${height}px` })",
  },
  {
    path: "packages/paper-crdt/src/native-layout-schema.ts",
    text: 'photoBlockSpec; slot.dataset.paperWrapSlot = ""; style.textContent = `${scope} > .bn-block > ${text}{display:block}`',
  },
  {
    path: "packages/paper-crdt/src/native-layout-paste.ts",
    text: 'import DOMPurify from "dompurify"; const html = DOMPurify.sanitize(clipboard); new DOMParser().parseFromString(html, "text/html"); editor.tryParseHTMLToBlocks(html)',
  },
  {
    path: "packages/paper-crdt/src/native-formatting-schema.ts",
    text: 'createBlockSpec({ type: "bulletListItem" }, { parse: element => element.closest("ul, ol") ? {} : undefined, parseContent: nestedListContent })',
  },
  {
    path: "packages/paper-crdt/src/native-layout-mount.ts",
    text: 'if (event.key === "Tab") { if (!target) return; event.preventDefault() }',
  },
  {
    path: "packages/paper-crdt/src/native-layout.ts",
    text: 'yXmlFragmentToBlocks(binding.engine, detached); doc.getXmlFragment("document-store")',
  },
  {
    path: "packages/paper-crdt/src/native-formatting-schema.ts",
    text: 'createBlockSpec({ type: "paragraph" }, { parse: element => element.tagName === "P" ? {} : undefined })',
  },
  {
    path: "packages/paper-crdt/src/native-formatting-styles.ts",
    text: 'const implementation = { parse(element) { return element.tagName === "STRONG" ? "on" : undefined } }',
  },
  {
    path: "apps/api/src/paper/native-output/formatted.ts",
    text: `import { formattedStyles } from "./formatted-styles.js"; effectiveParagraphStyle(paragraph); const bold = effective.bold === inherited.bold ? undefined : effective.bold; const link = richLink && !direct.characterStyle ? '<w:rStyle w:val="Hyperlink"/>' : ""`,
  },
  {
    path: "apps/api/src/paper/native-output/formatted.test.ts",
    text: 'import { compileFormattedNativeDocx } from "./formatted.js"',
  },
  {
    path: "packages/paper-crdt/src/native-formatting.ts",
    text: "yXmlFragmentToBlocks(binding.engine, fragment)",
  },
  {
    path: "packages/paper-crdt/src/native-formatting.ts",
    text: 'import { formattedDocumentSchema } from "@workspace/domain/internal/paper-presentation"',
  },
  {
    path: "packages/paper-crdt/src/native-formatting.ts",
    text: 'doc.getXmlFragment("private-native-cv-v4-r2")',
  },
  {
    path: "packages/paper-crdt/src/presentation-codec.ts",
    text: "write.text.format(write.from, write.length, write.attrs)",
  },
  {
    path: "packages/paper-crdt/src/native-formatting.ts",
    text: "updateYFragment(doc, fragment, node, mapping)",
  },
  {
    path: "packages/paper-crdt/src/native-formatting-engine.test.ts",
    text: 'import { createPrivateFormatting } from "./native-formatting.js"',
  },
  {
    path: "packages/paper-crdt/src/presentation-codec.ts",
    text: 'import { ok, type Result } from "@workspace/domain/internal/paper-presentation"',
  },
  {
    path: "packages/paper-crdt/src/presentation-codec.test.ts",
    text: 'import { validatePresentationPatch } from "@workspace/domain/internal/paper-presentation"',
  },
  {
    path: "packages/domain/src/paper-presentation.ts",
    text: 'export { ok } from "./paper-doc/presentation-values.js"',
  },
  {
    path: "packages/paper-crdt/src/presentation-codec.ts",
    text: 'import { readPresentationMeta } from "./presentation-meta.js"',
  },
  {
    path: "packages/paper-crdt/src/presentation-codec.ts",
    text: "span.text.format(offset, length, attributes)",
  },
  {
    path: "packages/paper-crdt/src/presentation-meta.ts",
    text: 'meta.set("inline", values)',
  },
  {
    path: "packages/paper-crdt/src/presentation-codec.test.ts",
    text: "function bindPresentationFixture(doc) { return doc }",
  },
  {
    path: "packages/paper-crdt/src/native-formatting-mount.ts",
    text: 'BlockNoteEditor.create({ links: { HTMLAttributes: { style: "text-decoration:none;color:inherit" } } })',
  },
  {
    path: "packages/paper-crdt/src/native-formatting-commands.ts",
    text: 'event.altKey && !mod && event.code === "Digit5" || event.metaKey && !event.altKey && key === "x"; depth + descendants(block) < 3; effectiveParagraphStyle(block); marks.filter(mark => mark.name !== "link"); normalizeLinkHref(address)',
  },
  {
    path: "packages/paper-crdt/src/native-formatting-decorations.ts",
    text: 'const list = { style: "list-style-type:disc", "aria-level": "1" }; mark.type.name === "link"; effectiveRunDecorations(direct, isLink, effective)',
  },
  {
    path: "packages/paper-crdt/src/native-layout-flow-mount.ts",
    text: 'const active = { ...paragraphInlineValues(style), ...canonicalStyles(styles) }; BlockNoteEditor.create({ links: { isValidLink: isSafeHref, HTMLAttributes: { style: "text-decoration:none;color:inherit" } } })',
  },
]

export const mistakes = [
  ...photoMistakes,
  {
    path: "apps/web/src/features/paper/rich-text-emphasis-group.tsx",
    text: '<Button className="size-11 md:size-8" />',
  },
  {
    path: "packages/paper-crdt/src/editor.ts",
    text: "const editor = { subscribe(listener) { editor.onChange(listener) } }",
  },
  {
    path: "packages/paper-crdt/src/editor.ts",
    text: "const editor = { formatInline(input) { mounted.formatInline(input) } }",
  },
  {
    path: "packages/paper-crdt/src/editor.ts",
    text: "const editor = { formatParagraph(input) { mounted.formatParagraph(input) } }",
  },
  {
    path: "packages/paper-crdt/src/native-layout-formatting.ts",
    text: "const inlines = []; return common(inlines)",
  },
  {
    path: "packages/paper-crdt/src/native-formatting-render-values.ts",
    text: "const css = `text-indent:${-indent.value}pt`",
  },
  {
    path: "apps/api/src/paper/native-output/formatted-properties.ts",
    text: 'function fontName() { return "Liberation Sans" }',
  },
  {
    path: "apps/web/src/test/paper-api-mock.ts",
    text: "export async function paperApiFetch() { return null }",
  },
  {
    path: "apps/web/src/features/paper/rich-page.tsx",
    text: '<Button size="icon" />',
  },
  {
    path: "apps/web/src/lib/paper-sync-recovery.ts",
    text: "openPaperClient(stored, { provenance: identity.provenance })",
  },
  {
    path: "apps/web/src/lib/paper-sync-recovery.ts",
    text: "const open = identity.provenance.schemaRevision === 2 ? openRichPaperClient : openPaperClient; open(stored, { provenance: identity.provenance })",
  },
  {
    path: "packages/paper-crdt/src/native-layout-flow-mount.ts",
    text: "defaultPasteHandler({ plainTextAsMarkdown: false })",
  },
  {
    path: "packages/paper-crdt/src/native-layout-flow-mount.ts",
    text: "defaultPasteHandler({}) || pasteIntoFlowText(editor, event)",
  },
  {
    path: "packages/paper-crdt/src/native-layout-flow-view.ts",
    text: 'globalThis.CSS?.supports("column-height: 100px")',
  },
  {
    path: "packages/paper-crdt/src/native-layout-flow-view.ts",
    text: 'CSS.supports?.("column-wrap: wrap")',
  },
  {
    path: "packages/paper-crdt/src/editor.ts",
    text: 'export { borrowFlowDocument } from "./native-layout-flow.js"',
  },
  {
    path: "packages/paper-crdt/src/editor.ts",
    text: 'import { commitFlowEdit } from "./native-layout-flow.js"',
  },
  {
    path: "packages/paper-crdt/src/editor.ts",
    text: "export const rawBinding = binding",
  },
  {
    path: "packages/paper-crdt/src/native-layout-flow.ts",
    text: 'import { nativeLayoutSchema } from "./native-layout-schema.js"',
  },
  {
    path: "packages/paper-crdt/src/native-layout-flow-codec.ts",
    text: 'import type { PrivateLayoutBlock } from "./native-layout-schema.js"',
  },
  {
    path: "apps/web/vitest.config.ts",
    text: 'const alias = { "@workspace/domain": path.resolve("packages/domain/src/index.ts") }',
  },
  {
    path: "apps/web/vite.config.ts",
    text: 'const alias = { "@workspace/domain": path.resolve("packages/domain/src/index.ts"), "@workspace/domain/internal/paper-presentation": path.resolve("packages/domain/src/paper-presentation.ts") }',
  },
  {
    path: "packages/paper-crdt/src/stored-document.ts",
    text: 'export { createPrivateFlow } from "./native-layout-flow.js"',
  },
  {
    path: "packages/paper-crdt/src/stored-document.ts",
    text: 'import { commitFlowEdit } from "./native-layout-flow.js"',
  },
  {
    path: "packages/paper-crdt/src/stored-document.ts",
    text: "export const rawBinding = binding",
  },
  {
    path: "packages/paper-crdt/src/stored-document.ts",
    text: 'doc.getMap("paper").set("richText", content)',
  },
  {
    path: "packages/paper-crdt/src/native-layout-flow-view.ts",
    text: "block.style.height = `${height}px`",
  },
  {
    path: "packages/paper-crdt/src/native-layout-schema.ts",
    text: 'photoBlockSpec; slot.dataset.paperWrapSlot = ""',
  },
  {
    path: "packages/paper-crdt/src/native-layout-paste.ts",
    text: 'const html = clipboard; new DOMParser().parseFromString(html, "text/html")',
  },
  {
    path: "packages/paper-crdt/src/native-layout-paste.ts",
    text: 'import DOMPurify from "dompurify"; const safe = DOMPurify.sanitize(clipboard); editor.tryParseHTMLToBlocks(clipboard)',
  },
  {
    path: "packages/paper-crdt/src/index.ts",
    text: 'export { commitLayoutPhotoEdit } from "./native-photo.js"',
  },
  {
    path: "packages/paper-crdt/src/native-formatting-schema.ts",
    text: 'createBlockSpec({ type: "bulletListItem" }, { parse: element => element.parentElement?.tagName === "UL" ? {} : undefined })',
  },
  {
    path: "packages/paper-crdt/src/native-layout-mount.ts",
    text: 'if (event.key === "Tab") { event.preventDefault(); if (!target) return }',
  },
  {
    path: "packages/paper-crdt/src/index.ts",
    text: 'export { mountPrivateLayout } from "./native-layout-mount.js"',
  },
  {
    path: "packages/paper-crdt/src/native-layout.ts",
    text: 'yXmlFragmentToBlocks(binding.engine, binding.fragment); doc.getText("table-mirror")',
  },
  {
    path: "packages/paper-crdt/src/native-layout.ts",
    text: 'doc.getXmlFragment("table-document"); doc.getMap("paper").set("runs", [])',
  },
  {
    path: "packages/paper-crdt/src/native-layout-mount.ts",
    text: "BlockNoteEditor.create({ links: {} })",
  },
  {
    path: "packages/paper-crdt/src/native-formatting-schema.ts",
    text: 'createBlockSpec({ type: "paragraph" }, { render })',
  },
  {
    path: "packages/paper-crdt/src/native-formatting-styles.ts",
    text: 'const implementation = { parse(element) { return element.getAttribute("data-paper-value") } }',
  },
  {
    path: "apps/api/src/paper/routes.ts",
    text: 'import { compileFormattedNativeDocx } from "./native-output/formatted.js"',
  },
  {
    path: "apps/api/src/paper/index.ts",
    text: 'export { compileFormattedNativeDocx } from "./native-output/formatted.js"',
  },
  {
    path: "apps/api/src/registry/paper.ts",
    text: 'const compiler = await import("../paper/native-output/formatted.js")',
  },
  {
    path: "packages/paper-crdt/src/native-formatting.ts",
    text: "yXmlFragmentToBlocks(binding.engine, binding.fragment)",
  },
  {
    path: "packages/paper-crdt/src/presentation-codec.ts",
    text: 'import { ok } from "../../domain/src/paper-doc/presentation-values.js"',
  },
  {
    path: "packages/paper-crdt/src/presentation-codec.test.ts",
    text: 'import type { Result } from "../../domain/src/paper-doc/presentation-values.js"',
  },
  {
    path: "packages/paper-crdt/src/presentation-codec.ts",
    text: 'export { ok } from "../../domain/src/paper-doc/presentation-values.js"',
  },
  {
    path: "packages/paper-crdt/src/presentation-codec.ts",
    text: 'const values = await import("../../domain/src/paper-doc/presentation-values.js")',
  },
  {
    path: "packages/paper-crdt/src/presentation-codec.ts",
    text: 'type Value = import("../../domain/src/paper-doc/presentation-values.js").Result<void>',
  },
  {
    path: "apps/web/src/paper.ts",
    text: 'import { bindPresentationFixture } from "./presentation-fixtures.js"',
  },
  {
    path: "packages/paper-crdt/src/index.ts",
    text: 'export * from "./presentation-fixtures.js"',
  },
  {
    path: "apps/api/src/paper.ts",
    text: 'const fixture = await import("./presentation-fixtures.js")',
  },
  {
    path: "packages/paper-crdt/src/presentation-codec.ts",
    text: 'doc.getArray("presentation-text")',
  },
  {
    path: "packages/paper-crdt/src/presentation-meta.ts",
    text: 'meta.set("text", text)',
  },
  {
    path: "packages/paper-crdt/src/native-formatting.ts",
    text: 'import { formattedDocumentSchema } from "../../domain/src/paper-doc/native-formatting.js"',
  },
  {
    path: "packages/paper-crdt/src/native-formatting-engine.test.ts",
    text: 'import type { FormatRun } from "../../domain/src/paper-doc/native-formatting.js"',
  },
  {
    path: "packages/paper-crdt/src/presentation-fixtures.ts",
    text: "export function bindPresentationFixture(doc) { return doc }",
  },
  {
    path: "packages/paper-crdt/src/index.ts",
    text: 'export { createPrivateFormatting } from "./native-formatting.js"',
  },
  {
    path: "apps/web/src/paper.ts",
    text: 'import { prepareFormatting } from "@workspace/paper-crdt/presentation-codec"',
  },
  {
    path: "apps/web/src/paper.ts",
    text: "const binding = ownFormattingBinding(doc)",
  },
  {
    path: "packages/paper-crdt/src/native-formatting.ts",
    text: 'doc.getXmlFragment("formatting-content")',
  },
  {
    path: "packages/paper-crdt/src/native-formatting-inline.ts",
    text: 'doc.getText("formatting-text")',
  },
  {
    path: "packages/paper-crdt/src/presentation-codec.ts",
    text: "updateYFragment(doc, fragment, node, mapping)",
  },
  {
    path: "packages/paper-crdt/src/presentation-codec.ts",
    text: 'writePrivateFormatting(binding, candidate, "patch")',
  },
  {
    path: "packages/paper-crdt/src/native-formatting-mount.ts",
    text: "BlockNoteEditor.create({ schema: nativeFormattingSchema })",
  },
  {
    path: "packages/paper-crdt/src/native-formatting-mount.ts",
    text: 'BlockNoteEditor.create({ links: { HTMLAttributes: { style: "text-decoration:underline" } } })',
  },
  {
    path: "packages/paper-crdt/src/native-formatting-commands.ts",
    text: 'if (mod && event.shiftKey && event.code === "Digit5") toggleMark("strike")',
  },
  {
    path: "packages/paper-crdt/src/native-layout-flow-mount.ts",
    text: "BlockNoteEditor.create({ links: { isValidLink: isSafeHref } }); const active = canonicalStyles(styles)",
  },
  {
    path: "packages/paper-crdt/src/native-formatting-decorations.ts",
    text: "Decoration.node(pos, end, { style: paragraphCss(values) })",
  },
  {
    path: "packages/paper-crdt/src/native-layout-flow-mount.ts",
    text: "BlockNoteEditor.create({ links: {} })",
  },
]

export const roundTwo = [
  {
    path: "packages/ui/src/components/select.tsx",
    mistake: "select-value]:line-clamp-1 select-value]:flex",
    clean: "select-value]:min-w-0 select-value]:truncate",
  },
  {
    path: "packages/paper-crdt/src/editor.ts",
    mistake: 'view.dom.setAttribute("aria-label", "Document content")',
    clean:
      'view.dom.setAttribute("aria-label", "Document content"); view.dom.style.outline = "none"',
  },
  {
    path: "packages/paper-crdt/src/editor.ts",
    mistake: "const start = mounted.activeFormatting().start",
    clean: "mounted.adjustIndent(360)",
  },
  {
    path: "apps/web/src/features/paper/rich-text-paragraph-group.tsx",
    mistake: "const start = formatting?.start",
    clean: "editor.adjustIndent(360)",
  },
  {
    path: "apps/web/src/features/paper/rich-text-paragraph-group.tsx",
    mistake: 'label="Increase indent (Ctrl+])"',
    clean: 'label={shortcutLabel("Increase indent (Ctrl+])")}',
  },
  {
    path: "apps/web/src/features/paper/rich-text-formatting.tsx",
    mistake: "const controls = (<fieldset>{children}</fieldset>)",
    clean: "const controls = <RichTextColorGroup />",
  },
  {
    path: "apps/web/src/features/paper/rich-text-color-group.tsx",
    mistake: 'color: "var(--background)"',
    clean: 'color: "white"',
  },
  {
    path: "scripts/paper-word-fonts.test.mjs",
    mistake: 'await import("../apps/api/src/paper/native-output/formatted.js")',
    clean: 'import { detect } from "./lib/paper-presentation.mjs"',
  },
]

export const roundOneClean = []
