import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { readTree } from "./tree.mjs"

const resolves = (ref) => !ref.includes("missing")

const leaf = (
  claim,
  evidence = [
    {
      ref: "scripts/library-card-lines.test.mjs:12",
      source: "Observed",
      verdict: "passed",
    },
  ]
) => ({
  claim,
  evidence,
})

const result = (overrides = {}) => ({
  kind: "assure",
  question: "Why did every Paper card show an empty sheet?",
  answer: {
    claim: "Paper cards now show the opening lines of each document",
    group: { axis: "reasons", covers: "the cause, the fix and its proof" },
    children: [
      leaf("Every card drew the same empty preview"),
      leaf("Each card now uses its own opening lines"),
      leaf("The check catches a return to empty cards"),
    ],
  },
  ...overrides,
})

const rules = (input) =>
  readTree(input, { resolves }).refusals.map((refusal) => refusal.rule)

describe("a logic tree", () => {
  it("accepts a grounded result and rolls every verdict up to the answer", () => {
    const { tree, refusals } = readTree(result(), { resolves })
    assert.deepEqual(refusals, [])
    assert.equal(tree.verdict, "passed")
    assert.deepEqual(
      tree.children.map((child) => child.label),
      ["A", "B", "C"]
    )
  })

  it("lets one open leaf hold the whole answer open", () => {
    const input = result()
    input.answer.children[2] = leaf(
      "The check catches a return to empty cards",
      [{ ref: "proof.md", source: "Observed", verdict: "open" }]
    )
    assert.equal(readTree(input, { resolves }).tree.verdict, "open")
  })

  it("lets a failed leaf beat an open one", () => {
    const input = result()
    input.answer.children[0].evidence[0].verdict = "failed"
    input.answer.children[1].evidence[0].verdict = "open"
    assert.equal(readTree(input, { resolves }).tree.verdict, "failed")
  })

  it("labels a deeper level by its branch, then by number, then by letter", () => {
    const input = result()
    input.answer.children[0] = {
      claim: "Every card drew the same empty preview",
      group: { axis: "reasons", covers: "both causes of the empty preview" },
      children: [
        {
          claim: "The card showed a blank preview",
          group: { axis: "parts", covers: "retrieval and display" },
          children: [
            leaf("The list omitted the text"),
            leaf("The card never asked for text"),
          ],
        },
        leaf("The empty preview always looked the same"),
      ],
    }
    const { tree, refusals } = readTree(input, { resolves })
    assert.deepEqual(refusals, [])
    assert.deepEqual(
      tree.children[0].children[0].children.map((child) => child.label),
      ["A1a", "A1b"]
    )
  })
})

describe("the rules a tree must keep", () => {
  it("one question: needs a kind, a question and an answer", () => {
    assert.deepEqual(rules({ kind: "guess", question: "", answer: null }), [
      "one-question",
    ])
  })

  it("one question: a topic or a statement is refused, since the page answers what the owner asked", () => {
    const { refusals } = readTree(
      result({ question: "The opening lines on each Paper card" }),
      { resolves }
    )
    assert.deepEqual(refusals, [
      {
        rule: "one-question",
        at: "question",
        message: 'write one question in the owner’s words and end it with "?"',
      },
    ])
  })

  it("sentence: a claim is a sentence, not a topic", () => {
    const input = result()
    input.answer.children[1].claim = "Outcomes"
    assert.deepEqual(rules(input), ["sentence"])
  })

  it("shape: a branch has two to four children", () => {
    const input = result()
    input.answer.children = [input.answer.children[0]]
    assert.deepEqual(rules(input), ["shape"])
  })

  it("shape: a node is a branch or a leaf, never both", () => {
    const input = result()
    input.answer.evidence = [
      { ref: "proof.md", source: "Observed", verdict: "passed" },
    ]
    assert.deepEqual(rules(input), ["shape"])
  })

  it("shape: the answer always has branches, and is never chosen itself", () => {
    const flat = result()
    flat.answer = {
      claim: "Paper cards now show the opening lines of each document",
      evidence: [{ ref: "a.md", source: "Observed", verdict: "passed" }],
    }
    assert.deepEqual(rules(flat), ["shape"])
    const picked = result()
    picked.answer.chosen = true
    assert.deepEqual(rules(picked), ["vertical"])
  })

  it("shape: a tree is at most three levels below the answer", () => {
    const input = result()
    const deep = (depth) =>
      depth === 0
        ? leaf("This leaf sits too deep")
        : {
            claim: `This branch sits at depth ${String(depth)}`,
            group: { axis: "reasons", covers: "both halves" },
            children: [deep(depth - 1), leaf("This leaf is a sibling")],
          }
    input.answer.children[0] = deep(3)
    assert.deepEqual(rules(input), ["shape"])
  })

  it("vertical: the first split must answer the kind of question", () => {
    assert.deepEqual(rules(result({ kind: "decide" })), [
      "vertical",
      "vertical",
    ])
    assert.deepEqual(rules(result({ kind: "explain" })), ["vertical"])
  })

  it("vertical: a decision marks exactly one option as chosen, and nothing else can be", () => {
    const plan = {
      kind: "decide",
      question: "How should a Paper card preview a document?",
      answer: {
        claim: "Show the opening lines of the document",
        group: { axis: "options", covers: "the previews a card could use" },
        children: [
          leaf("Keep showing an empty preview"),
          leaf("Show the text of the document"),
        ],
      },
    }
    assert.deepEqual(rules(plan), ["vertical"])
    plan.answer.children[1].chosen = true
    assert.deepEqual(
      readTree(plan, { resolves }).tree.children.map(
        (child) => child.chosen === true
      ),
      [false, true]
    )
    const input = result()
    input.answer.children[0].chosen = true
    assert.deepEqual(rules(input), ["vertical"])
  })

  it("horizontal: every split names its axis and what it covers", () => {
    const input = result()
    input.answer.group = { axis: "things", covers: "" }
    assert.deepEqual(rules(input), ["horizontal", "horizontal"])
  })

  it("horizontal: only a steps split may loop back to its first step", () => {
    const input = result()
    input.answer.group.loop = true
    assert.deepEqual(rules(input), ["horizontal"])
    const flow = result({ kind: "explain" })
    flow.answer.group = {
      axis: "steps",
      covers: "one round of review",
      loop: true,
    }
    assert.deepEqual(rules(flow), [])
  })

  it("grounded: every leaf has evidence and every reference opens", () => {
    const input = result()
    input.answer.children[0].evidence = []
    input.answer.children[1].evidence[0].ref = "missing.md:4"
    assert.deepEqual(rules(input), ["grounded", "grounded"])
  })

  it("source: a proposal cannot pass, and a result cannot rest on a proposal or on no verdict", () => {
    const input = result()
    input.answer.children[0].evidence[0].source = "Proposal"
    delete input.answer.children[1].evidence[0].verdict
    assert.deepEqual(rules(input), ["source", "source"])
  })

  it("source: a plan may rest on proposals with no verdict", () => {
    const plan = {
      kind: "decide",
      question: "How should Apply show a Job without a next event?",
      answer: {
        claim: "Give the person a place to add an event",
        group: {
          axis: "options",
          covers: "the ways to show the missing event",
        },
        children: [
          leaf("Keep the event area empty", [
            { ref: "docs/product/apply/GLOSSARY.md:25", source: "Observed" },
          ]),
          {
            ...leaf("Show an action to add an event", [
              { ref: "plan.md", source: "Proposal" },
            ]),
            chosen: true,
          },
        ],
      },
    }
    const { tree, refusals } = readTree(plan, { resolves })
    assert.deepEqual(refusals, [])
    assert.equal(tree.verdict, null)
  })

  it("plain: a claim is short and has no code in it", () => {
    const input = result()
    input.answer.children[0].claim =
      "The card in paper-list.tsx showed an empty sheet"
    input.answer.children[1].claim = "readPaper and previewPaper now agree"
    input.answer.children[2].claim =
      "Three runs of the Paper library show the card always previews the opening lines of the document it belongs to"
    assert.deepEqual(rules(input), ["plain", "plain", "plain"])
  })

  it("plain: the question and what a split covers stay short and plain too", () => {
    const input = result({
      question: "Does `readPaper` supply the opening lines?",
    })
    input.answer.group.covers =
      "the cause, the fix and its proof, and every edge case we found along the way"
    assert.deepEqual(rules(input), ["plain", "plain"])
  })

  it("plain: a box may explain its claim in a short plain detail, and the detail is kept", () => {
    const input = result()
    input.answer.detail =
      "A person can tell their documents apart before opening them."
    input.answer.children[0].detail =
      "The `readPaper` call never supplied text for the card."
    assert.deepEqual(rules(input), ["plain"])
    input.answer.children[0].detail =
      "Every card used an empty image even when a document had text."
    const { tree } = readTree(input, { resolves })
    assert.equal(
      tree.detail,
      "A person can tell their documents apart before opening them."
    )
    assert.equal(
      tree.children[0].detail,
      "Every card used an empty image even when a document had text."
    )
  })

  it("weakest support: a verdict lives on evidence, never on a claim", () => {
    const input = result()
    input.answer.verdict = "passed"
    assert.deepEqual(rules(input), ["weakest"])
  })
})
