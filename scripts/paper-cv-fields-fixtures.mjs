export const clean = `
const specs = {
  paperCvField: createBlockSpec({ type: "paperCvField", content: "inline", propSchema: { ownerId: text, fieldKey: text, itemId: text } }, { render })(),
}
function writeNativeCvDocument(doc, target) {
  const candidate = admit(target)
  doc.transact(() => write(candidate))
}
function writeNativeCvBlocks(doc, blocks) {
  const candidate = admit(fromNativeCvBlocks(blocks))
  doc.transact(() => write(candidate))
}
function read(doc, engine) {
  validateNativeCvWire(fragment, engine)
  return fromNativeCvBlocks(yXmlFragmentToBlocks(engine, fragment))
}
`
export const scalarField = clean.replace('content: "inline"', 'content: "none"')
export const mirror = clean.replace(
  "ownerId: text, fieldKey: text, itemId: text",
  "ownerId: text, fieldKey: text, itemId: text, richText: text"
)
export const lateAdmission = clean.replace(
  "const candidate = admit(target)",
  "doc.transact(() => write(target))\n  const candidate = admit(target)"
)
export const permissiveOrdinary = clean.replace(
  "admit(fromNativeCvBlocks(blocks))",
  "admit(blocks)"
)
export const droppedWireMarks = clean.replace(
  "validateNativeCvWire(fragment, engine)",
  "readSomethingElse(fragment)"
)
