const verdictWords = { passed: "Passed", open: "Open", failed: "Failed" }
const escapeMarkdown = (text) =>
  text.replace(/[\\*_\[\]]/g, "\\$&").replace(
    /[&<>]/g,
    (mark) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
      })[mark]
  )

const linked = (ref) => ref.startsWith("https://")
const longestRef = 22

export function shortRef(ref) {
  const pull = ref.match(/^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/(\d+)/)
  if (pull) return `PR ${pull[1]}`
  let short = linked(ref)
    ? new URL(ref).pathname.split("/").filter(Boolean).at(-1)
    : ref.split("/").at(-1)
  short ??= new URL(ref).hostname
  try {
    short = decodeURIComponent(short)
  } catch {
    short = short.replace(/%20/g, " ")
  }
  return short.length > longestRef
    ? `…${short.slice(-(longestRef - 1))}`
    : short
}

const splitLine = (group) =>
  `Split by ${group.axis}. Covers ${escapeMarkdown(group.covers)}.`

function markdownNode(node, indent) {
  const pad = "  ".repeat(indent)
  const verdict = node.verdict ? ` (${verdictWords[node.verdict]})` : ""
  const lines = [
    `${pad}- **${node.label}.** ${escapeMarkdown(node.claim)}${node.chosen ? " (chosen)" : ""}${verdict}`,
  ]
  if (node.detail) lines.push("", `${pad}  ${escapeMarkdown(node.detail)}`, "")
  if (node.group) lines.push("", `${pad}  ${splitLine(node.group)}`, "")
  for (const piece of node.evidence ?? []) {
    const ref = linked(piece.ref)
      ? `[${escapeMarkdown(shortRef(piece.ref))}](<${new URL(piece.ref).href}>)`
      : `\`${piece.ref.replaceAll("\`", "\\`")}\``
    const tag = piece.source === "Observed" ? "" : `${piece.source}: `
    lines.push(
      `${pad}  - ${tag}${ref}${piece.verdict ? ` (${piece.verdict})` : ""}`
    )
  }
  for (const child of node.children ?? [])
    lines.push(...markdownNode(child, indent + 1))
  return lines
}

export function toMarkdown(tree) {
  return [
    `*${escapeMarkdown(tree.question.trim())}*`,
    ...(tree.verdict ? ["", `Verdict: ${verdictWords[tree.verdict]}`] : []),
    ...(tree.detail ? ["", escapeMarkdown(tree.detail)] : []),
    "",
    splitLine(tree.group),
    "",
    ...tree.children.flatMap((child) => markdownNode(child, 0)),
    "",
  ].join("\n")
}
