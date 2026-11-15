export const mistakes = [
  {
    path: "packages/paper-crdt/src/native-formatting-mount.ts",
    text: "BlockNoteEditor.create({ schema: nativeFormattingSchema })",
  },
  {
    path: "packages/paper-crdt/src/native-formatting-mount.ts",
    text: 'BlockNoteEditor.create({ links: { HTMLAttributes: { style: "text-decoration:underline" } } })',
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
]
export const clean = [
  {
    path: "packages/paper-crdt/src/native-formatting-mount.ts",
    text: 'BlockNoteEditor.create({ links: { HTMLAttributes: { style: "text-decoration:none;color:inherit" } } })',
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
]
