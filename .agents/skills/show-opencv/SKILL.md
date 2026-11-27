---
name: show-opencv
description: Write and validate the proof tree that opens an OpenCV fix, hotfix or screen pull request.
---

# Show OpenCV

Use a proof tree for every fix or hotfix PR and every PR that changes a screen under the [screen rule](../../../scripts/ocv-tools/rules/screens.mjs). Other PRs use **Now:** and **Proof:**.

Ask the question the owner wants answered. State what a person sees or gets in one short sentence. Use product words such as Paper, Coach, Job and Apply. Keep the cause, the change and the check distinct. Add one or two plain sentences of detail when a claim needs them. Put code names, paths and commands in the evidence.

Write an `assure` tree for a PR. Each node has a `claim` and may have a `detail`. Give the answer a `group` and `children`. Give every leaf `evidence` with an openable `ref`, a `source` and a `verdict`.

```json
{
  "kind": "assure",
  "question": "Why did every Paper card show an empty sheet?",
  "answer": {
    "claim": "Paper cards now show the opening lines of each document",
    "group": { "axis": "reasons", "covers": "the cause and the fix" },
    "children": [
      {
        "claim": "Every card drew the same empty preview",
        "evidence": [
          {
            "ref": "https://github.com/Rickvu309/opencv/pull/2133",
            "source": "Observed",
            "verdict": "passed"
          }
        ]
      },
      {
        "claim": "Each card now uses its own opening lines",
        "evidence": [
          {
            "ref": "https://github.com/Rickvu309/opencv/pull/2133/files",
            "source": "Observed",
            "verdict": "passed"
          }
        ]
      }
    ]
  }
}
```

Run `node .agents/skills/show-opencv/bin/logic.mjs tree.json [--out dir]` from the checkout. Fix any refusals. The command prints the answer's verdict and writes `tree.md`.

Put `answer.claim` in bold on the first line. Follow it with `<details><summary>Detail</summary>`, a blank line, the contents of `tree.md` and `</details>`. Include a command and its actual result, an image or a CI run link. Add `Caught by:` and `Introduced by:` on fixes and hotfixes. Put screen evidence under `## Before / after`.

## Rules

1. Give the tree one question ending in `?`, a kind and an answer.
2. Write each claim as a sentence of at least three words.
3. Give a node two to four children or evidence. The answer needs children. Keep to three levels below the answer.
4. Split an `assure` answer by `reasons`, a `decide` answer by `options` or an `explain` answer by `steps` or `parts`. Mark exactly one decision option `"chosen": true`.
5. Give each split an `axis` and say what it `covers`. Check that the branches cover the split without repeating each other.
6. Support each leaf with evidence. Use a file, a file and line, or an HTTPS link. Use links to published evidence in a PR.
7. Label evidence `Proposal`, `Prototype` or `Observed`. A proposal cannot pass. An `assure` tree uses only evidence that was tried or observed and has a verdict.
8. Give verdicts only to evidence. The weakest verdict under a node becomes its verdict, in order from `failed` to `open` to `passed`.
9. Use plain words without backticks, filenames, paths or code identifiers. Use up to 16 words in a question or claim, 22 in the answer, 14 in coverage and 28 in detail.
