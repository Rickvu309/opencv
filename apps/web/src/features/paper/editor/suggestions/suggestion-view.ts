import type {
  AgentCommand,
  Block,
  BlockId,
  Document,
  Origin,
} from "@workspace/domain/paper-doc"
import type { PaperEngine } from "@workspace/paper-engine"

import { pageCommands } from "./agent-commands.ts"

export type Proposal = { id: string; commands: AgentCommand[] }

export type SuggestedLine = {
  proposal: string
  before: Block | null
  after: Block | null
}

export type SuggestionView = {
  open: Proposal[]
  stale: string[]
  lines: Map<BlockId, SuggestedLine[]>
}

export type SuggestionRole = {
  proposal: string
  owner: BlockId
  role: "old" | "new" | "gap"
}

export type DisplayDocument = {
  doc: Document
  roles: Map<string, SuggestionRole>
}

export function coachOrigin(client: string, proposals: string[]): Origin {
  return {
    kind: "coach",
    actor: "coach",
    client,
    proposal: proposals.join(" "),
  }
}

function previewOf(engine: PaperEngine, doc: Document, proposal: Proposal) {
  const client = `suggest-${proposal.id}`
  const commands = pageCommands(doc, proposal.commands)
  if (!commands) return null
  const scratch = engine.load(doc, 0, client)
  const result = engine.run(
    scratch,
    commands,
    coachOrigin(client, [proposal.id])
  )
  return "refusal" in result ? null : engine.read(result.state).doc
}

export function mapSuggestions(
  engine: PaperEngine,
  doc: Document,
  proposals: readonly Proposal[]
): SuggestionView {
  const view: SuggestionView = { open: [], stale: [], lines: new Map() }
  const base = engine.read(engine.load(doc, 0, "suggest-base")).doc
  const before = new Map(base.content.map((block) => [block.attrs.id, block]))
  const add = (at: BlockId, line: SuggestedLine) =>
    view.lines.set(at, [...(view.lines.get(at) ?? []), line])
  for (const proposal of proposals) {
    const after = previewOf(engine, doc, proposal)
    if (!after) {
      view.stale.push(proposal.id)
      continue
    }
    view.open.push(proposal)
    const kept = new Set<string>()
    let anchor = doc.content[0]?.attrs.id ?? null
    for (const block of after.content) {
      const old = before.get(block.attrs.id)
      if (!old) {
        if (anchor)
          add(anchor, { proposal: proposal.id, before: null, after: block })
        continue
      }
      kept.add(block.attrs.id)
      anchor = block.attrs.id
      if (JSON.stringify(old) !== JSON.stringify(block))
        add(block.attrs.id, {
          proposal: proposal.id,
          before: old,
          after: block,
        })
    }
    for (const old of base.content)
      if (!kept.has(old.attrs.id))
        add(old.attrs.id, { proposal: proposal.id, before: old, after: null })
  }
  return view
}

function gapBlock(id: string): Block {
  return {
    type: "text_block",
    attrs: {
      id: id as BlockId,
      kind: "subtitle",
      list: null,
      level: 0,
      align: "left",
      lineSpacing: null,
      keepWithNext: null,
    },
    content: [],
  } as unknown as Block
}

function renamed(block: Block, id: string): Block {
  return { ...block, attrs: { ...block.attrs, id: id as BlockId } } as Block
}

export function displayDocument(
  doc: Document,
  view: SuggestionView,
  gaps: number
): DisplayDocument {
  const roles = new Map<string, SuggestionRole>()
  if (view.lines.size === 0) return { doc, roles }
  const content: Block[] = []
  for (const block of doc.content) {
    const owner = block.attrs.id
    const lines = view.lines.get(owner) ?? []
    content.push(block)
    for (const line of lines)
      if (line.before)
        roles.set(owner, { proposal: line.proposal, owner, role: "old" })
    const proposals = [...new Set(lines.map((line) => line.proposal))]
    for (const proposal of proposals) {
      lines
        .filter((line) => line.proposal === proposal && line.after)
        .forEach((line, n) => {
          const id = `${owner}~${proposal}~new${n}`
          roles.set(id, { proposal, owner, role: "new" })
          content.push(renamed(line.after!, id))
        })
      for (let n = 0; n < gaps; n++) {
        const id = `${owner}~${proposal}~gap${n}`
        roles.set(id, { proposal, owner, role: "gap" })
        content.push(gapBlock(id))
      }
    }
  }
  return { doc: { ...doc, content } as Document, roles }
}
