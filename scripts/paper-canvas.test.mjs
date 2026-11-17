import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { detect } from "./lib/paper-canvas.mjs"
import {
  applyCanvasBytes,
  contentOf,
  emptyTextNode,
  fillPaintedText,
  hasMark,
  hasNum,
  isCarrier,
  mainXml,
  member,
  sectCount,
  packageFromBody,
  paragraphsOf,
  pStyleOf,
  repack,
  runsOf,
  wordIds,
} from "./lib/paper-canvas-bytes.mjs"
import {
  BUMP,
  FIRST,
  H1,
  ID_A,
  ID_B,
  KEY_A,
  KEY_B,
  KEY_C,
  MARK,
  MERGED_KEY,
  NUM,
  PPR,
  SECT,
  TID_A,
  TID_B,
  bump,
  carrier,
  command,
  judgeDelete,
  judgeMerge,
  judgeMint,
  judgePaper,
  judgeProposal,
  judgeRefusal,
  judgeSession,
  judgeSplit,
  mintSide,
  paperEdit,
  removal,
  replaceNth,
  replaceOnce,
  reply,
  split,
  twoSide,
  writing,
} from "./lib/paper-canvas-checks.mjs"

function paintedCanvasBytes() {
  return packageFromBody(writing("") + carrier())
}

test("a formatted empty page splits, merges, and deletes", () => {
  const minted = paintedCanvasBytes()
  const side = mintSide()
  assert.deepEqual(judgeMint(minted), [])
  assert.equal(sectCount(minted), 1)
  assert.match(
    member(minted, "word/styles.xml"),
    /w:type="paragraph" w:default="1" w:styleId="Normal"/
  )
  removal(
    judgeMint(
      packageFromBody(writing(FIRST) + writing("Beta", PPR, ID_B, TID_B))
    ),
    "mintShape"
  )
  const empty = split(minted, side, 0)
  assert.equal(empty.status, "APPLIED")
  assert.deepEqual(judgeSplit(minted, empty.bytes, side, empty.sidecar, 0), [])
  assert.equal(emptyTextNode(paragraphsOf(empty.bytes)[0]), true)
  assert.equal(emptyTextNode(paragraphsOf(empty.bytes)[1]), true)
  const stripped = (() => {
    const ps = paragraphsOf(empty.bytes)
    const xml = mainXml(empty.bytes)
    return repack(
      empty.bytes,
      xml.replace(ps[0].slice, ps[0].slice.replace(runsOf(ps[0])[0].slice, ""))
    )
  })()
  removal(judgeSplit(minted, stripped, side, empty.sidecar, 0), "scalarCaret")
  const copied = replaceOnce(
    empty.bytes,
    paragraphsOf(empty.bytes)[1].slice,
    paragraphsOf(empty.bytes)[1].slice.replace("</w:p>", `${SECT}</w:p>`)
  )
  removal(judgeSplit(minted, copied, side, empty.sidecar, 0), "sectPrNotCopied")
  removal(
    judgeSplit(
      minted,
      replaceOnce(empty.bytes, 'w:w="12240"', 'w:w="12241"'),
      side,
      empty.sidecar,
      0
    ),
    "tailUntouched"
  )
  const typed = fillPaintedText(minted, FIRST)
  assert.equal(contentOf(paragraphsOf(typed)[0]), FIRST)
  assert.equal(paragraphsOf(typed)[1].slice, paragraphsOf(minted)[1].slice)
  assert.deepEqual(wordIds(paragraphsOf(typed)[0]), {
    paraId: ID_A,
    textId: TID_A,
  })
  for (const caret of [0, 1, 2, 3, 4]) {
    const got = split(typed, side, caret)
    assert.deepEqual(
      judgeSplit(typed, got.bytes, side, got.sidecar, caret),
      [],
      `caret ${caret}`
    )
  }
  const typedSplit = split(typed, side, 1)
  const grapheme = replaceOnce(
    replaceOnce(typedSplit.bytes, "<w:t>e</w:t>", "<w:t>e\u0301</w:t>"),
    `<w:t>\u0301\u{1F600}X</w:t>`,
    `<w:t>\u{1F600}X</w:t>`
  )
  removal(
    judgeSplit(typed, grapheme, side, typedSplit.sidecar, 1),
    "scalarCaret"
  )
  removal(["scalarCaret"], "scalarCaret")
  removal(
    judgeSplit(
      typed,
      replaceNth(
        typedSplit.bytes,
        `<w:pPr>${PPR}</w:pPr>`,
        '<w:pPr><w:pStyle w:val="Normal"/></w:pPr>',
        1
      ),
      side,
      typedSplit.sidecar,
      1
    ),
    "directProperties"
  )
  removal(
    judgeSplit(
      typed,
      replaceOnce(
        typedSplit.bytes,
        `w14:textId="${TID_A}"`,
        `w14:textId="${BUMP}"`
      ),
      side,
      bump(typedSplit.sidecar),
      1
    ),
    "idsUnbumped"
  )
  removal(
    judgeSplit(
      typed,
      replaceOnce(
        typedSplit.bytes,
        "<w:p><w:pPr>",
        `<w:p w14:paraId="${ID_A}" w14:textId="${TID_A}"><w:pPr>`
      ),
      side,
      typedSplit.sidecar,
      1
    ),
    "idsUnbumped"
  )
  const oldKey = {
    ...typedSplit.sidecar,
    paragraphs: typedSplit.sidecar.paragraphs.map((row, i) =>
      i === 0 ? { ...row, key: KEY_A } : row
    ),
  }
  removal(judgeSplit(typed, typedSplit.bytes, side, oldKey, 1), "idsUnbumped")
  const merged = applyCanvasBytes(
    typedSplit.bytes,
    { op: "mergePrevious", paragraph: typedSplit.sidecar.paragraphs[1].key },
    typedSplit.sidecar,
    { keys: [MERGED_KEY] }
  )
  assert.equal(merged.status, "APPLIED")
  assert.deepEqual(
    judgeMerge(
      typedSplit.bytes,
      merged.bytes,
      typedSplit.sidecar,
      merged.sidecar
    ),
    []
  )
  const mergedRuns = runsOf(
    paragraphsOf(merged.bytes).find((paragraph) => !isCarrier(paragraph))
  )
  assert.equal(mergedRuns.length, 2)
  assert.equal(mergedRuns[0].rPr, mergedRuns[1].rPr)
  assert.notEqual(mergedRuns[0].text + mergedRuns[1].text, mergedRuns[0].text)
  const one = paragraphsOf(merged.bytes).find(
    (paragraph) => !isCarrier(paragraph)
  )
  const concatenated = repack(
    merged.bytes,
    mainXml(merged.bytes).replace(one.slice, writing(FIRST))
  )
  removal(
    judgeMerge(
      typedSplit.bytes,
      concatenated,
      typedSplit.sidecar,
      merged.sidecar
    ),
    "runMove"
  )
  removal(
    judgeMerge(
      typedSplit.bytes,
      replaceOnce(
        merged.bytes,
        `w14:textId="${TID_A}"`,
        `w14:textId="${BUMP}"`
      ),
      typedSplit.sidecar,
      bump(merged.sidecar)
    ),
    "idsUnbumped"
  )
  const deleted = applyCanvasBytes(
    empty.bytes,
    { op: "deleteParagraph", paragraph: empty.sidecar.paragraphs[1].key },
    empty.sidecar
  )
  assert.equal(deleted.status, "APPLIED")
  assert.deepEqual(
    judgeDelete(empty.bytes, deleted.bytes, empty.sidecar, deleted.sidecar, 1),
    []
  )
  assert.equal(mainXml(deleted.bytes), mainXml(minted))
  const deletedPainted = applyCanvasBytes(
    minted,
    { op: "deleteParagraph", paragraph: KEY_A },
    side
  )
  assert.deepEqual(
    judgeDelete(minted, deletedPainted.bytes, side, deletedPainted.sidecar, 0),
    []
  )
  assert.equal(isCarrier(paragraphsOf(deletedPainted.bytes)[0]), true)
  assert.equal(
    applyCanvasBytes(typed, { op: "deleteParagraph", paragraph: KEY_A }, side)
      .status,
    "REFUSED"
  )
  assert.deepEqual(judgeDelete(typed, typed, side, side, 0), [])
  assert.equal(
    applyCanvasBytes(minted, { op: "deleteParagraph", paragraph: KEY_C }, side)
      .status,
    "REFUSED"
  )
  const forcedTyped = applyCanvasBytes(
    typed,
    { op: "deleteParagraph", paragraph: KEY_A },
    side,
    { force: true }
  )
  removal(
    judgeDelete(typed, forcedTyped.bytes, side, forcedTyped.sidecar, 0),
    "emptyDelete"
  )
  const forcedCarrier = applyCanvasBytes(
    minted,
    { op: "deleteParagraph", paragraph: KEY_C },
    side,
    { force: true }
  )
  removal(
    judgeDelete(minted, forcedCarrier.bytes, side, forcedCarrier.sidecar, 1),
    "emptyDelete"
  )
  removal(
    judgeDelete(
      empty.bytes,
      replaceOnce(
        deleted.bytes,
        `w14:textId="${TID_A}"`,
        `w14:textId="${BUMP}"`
      ),
      empty.sidecar,
      bump(deleted.sidecar),
      1
    ),
    "idsUnbumped"
  )
  const emptyMerge = applyCanvasBytes(
    empty.bytes,
    { op: "mergePrevious", paragraph: empty.sidecar.paragraphs[1].key },
    empty.sidecar
  )
  assert.equal(emptyMerge.status, "REFUSED")
  assert.equal(Buffer.from(emptyMerge.bytes).equals(empty.bytes), true)
})

test("numbering, differing styles, and a paragraph mark stay unchanged", () => {
  const numbered = packageFromBody(
    writing(FIRST, PPR + NUM) +
      writing("Beta", PPR + NUM, ID_B, TID_B) +
      carrier()
  )
  const styled = packageFromBody(
    writing(FIRST) + writing("Beta", H1, ID_B, TID_B) + carrier()
  )
  const marked = packageFromBody(
    writing(FIRST, PPR + MARK) + writing("Beta", PPR, ID_B, TID_B) + carrier()
  )
  assert.equal(
    hasNum(paragraphsOf(numbered)[0]) && hasNum(paragraphsOf(numbered)[1]),
    true
  )
  assert.notEqual(
    pStyleOf(paragraphsOf(styled)[0]),
    pStyleOf(paragraphsOf(styled)[1])
  )
  assert.equal(hasMark(paragraphsOf(marked)[0]), true)
  for (const [name, bytes, code] of [
    ["numbering", numbered, "numberingRefused"],
    ["styles", styled, "differingStylesRefused"],
    ["mark", marked, "paragraphMarkRefused"],
  ]) {
    const side = twoSide()
    for (const op of ["split", "mergePrevious", "deleteParagraph"]) {
      const quiet = applyCanvasBytes(bytes, command(op, side), side, {
        keys: [
          "c11c11c1-c11c-411c-811c-c11c11c11c11",
          "d11d11d1-d11d-411d-811d-d11d11d11d11",
        ],
      })
      assert.equal(quiet.status, "REFUSED", name)
      assert.deepEqual(
        judgeRefusal(bytes, quiet.bytes, side, quiet.sidecar, code),
        []
      )
      const mutant = applyCanvasBytes(bytes, command(op, side), side, {
        force: true,
        keys: [
          "c11c11c1-c11c-411c-811c-c11c11c11c11",
          "d11d11d1-d11d-411d-811d-d11d11d11d11",
        ],
      })
      assert.equal(Buffer.from(mutant.bytes).equals(bytes), false, name)
      removal(
        judgeRefusal(bytes, mutant.bytes, side, mutant.sidecar, code),
        code
      )
    }
  }
})

test("a frozen proposal and the other session do not move the winner", () => {
  const typed = fillPaintedText(paintedCanvasBytes(), FIRST)
  const splitBytes = split(typed, mintSide(), 1).bytes
  const approved = {
    error: "Basis conflict",
    rows: 0,
    bytes: splitBytes,
    status: "pending",
  }
  assert.deepEqual(judgeProposal(approved, splitBytes), [])
  removal(judgeProposal({ ...approved, rows: 1 }, splitBytes), "zeroRows")
  removal(
    judgeProposal({ ...approved, bytes: typed }, splitBytes),
    "laterBytes"
  )
  removal(
    judgeProposal({ ...approved, error: null }, splitBytes),
    "basisConflict"
  )
  removal(
    judgeProposal({ ...approved, status: "approved" }, splitBytes),
    "stillPending"
  )
  const winner = { commandId: "win", words: "kept", saved: true, generation: 2 }
  const loser = {
    commandId: "lose",
    words: "unsent draft that is not the split",
    saved: false,
    generation: 2,
  }
  const winnerAfter = reply(winner, {
    kind: "refusal",
    commandId: loser.commandId,
    generation: 2,
  })
  const loserAfter = reply(loser, {
    kind: "receipt",
    commandId: winner.commandId,
    generation: 2,
    words: winner.words,
    stored: true,
  })
  assert.deepEqual(judgeSession(winnerAfter, loserAfter, winner, loser), [])
  assert.equal(
    reply(winner, {
      kind: "refusal",
      commandId: winner.commandId,
      generation: 2,
    }).saved,
    false
  )
  removal(
    judgeSession({ ...winnerAfter, saved: false }, loserAfter, winner, loser),
    "winnerSaved"
  )
  removal(
    judgeSession(
      winnerAfter,
      { ...loserAfter, words: winner.words },
      winner,
      loser
    ),
    "loserDraft"
  )
  const minted = paintedCanvasBytes()
  assert.equal(
    Buffer.from(paperEdit(minted, { before: "", after: "Z" })).equals(minted),
    true
  )
  assert.equal(
    Buffer.from(paperEdit(typed, { before: "e", after: "e\n" })).equals(typed),
    true
  )
  removal(
    judgePaper(
      typed,
      replaceOnce(typed, `<w:t>${FIRST}</w:t>`, `<w:t>${FIRST}\n</w:t>`)
    ),
    "paperEditEnter"
  )
  removal(
    judgePaper(minted, replaceOnce(minted, "<w:t></w:t>", "<w:t>Z</w:t>")),
    "paperEditEnter"
  )
})

test("paper.edit does not gain Enter", () => {
  const root = fileURLToPath(new URL("..", import.meta.url))
  for (const file of [
    "packages/domain/src/paper-package.ts",
    "packages/domain/src/paper-contract.ts",
    "apps/api/src/paper/package-engine.ts",
  ])
    assert.deepEqual(detect(readFileSync(root + file, "utf8"), file), [])
  assert.deepEqual(
    detect(
      'const edit = { op: "split" }\n',
      "packages/domain/src/paper-package.ts"
    ),
    [{ kind: "paper-canvas", detail: "edit-accepts-enter" }]
  )
  assert.deepEqual(
    detect(
      'const edit = { op: "split" }\n',
      "apps/api/src/paper/package-canvas.ts"
    ),
    []
  )
})

test("a split keeps escaped letters and leaves locked paragraphs unchanged", () => {
  const side = mintSide()
  const ampersand = fillPaintedText(paintedCanvasBytes(), "R&D")
  const cut = applyCanvasBytes(
    ampersand,
    { op: "split", paragraph: side.paragraphs[0].key, at: 1 },
    side
  )
  assert.equal(cut.status, "APPLIED")
  const written = paragraphsOf(cut.bytes).filter(
    (paragraph) => !isCarrier(paragraph)
  )
  assert.equal(contentOf(written[0]), "R")
  assert.equal(contentOf(written[1]), "&D")
  const later = applyCanvasBytes(
    ampersand,
    { op: "split", paragraph: side.paragraphs[0].key, at: 2 },
    side
  )
  const laterText = paragraphsOf(later.bytes).filter(
    (paragraph) => !isCarrier(paragraph)
  )
  assert.equal(contentOf(laterText[0]), "R&")
  assert.equal(contentOf(laterText[1]), "D")
  const less = fillPaintedText(paintedCanvasBytes(), "a<b")
  const angled = applyCanvasBytes(
    less,
    { op: "split", paragraph: side.paragraphs[0].key, at: 1 },
    side
  )
  const angledText = paragraphsOf(angled.bytes).filter(
    (paragraph) => !isCarrier(paragraph)
  )
  assert.equal(contentOf(angledText[0]), "a")
  assert.equal(contentOf(angledText[1]), "<b")
  const linked = packageFromBody(
    `<w:p w14:paraId="${ID_A}" w14:textId="${TID_A}"><w:pPr>${PPR}</w:pPr><w:hyperlink r:id="rId1"><w:r><w:t>link</w:t></w:r></w:hyperlink></w:p>` +
      writing("next", PPR, ID_B, TID_B) +
      carrier()
  )
  const merged = applyCanvasBytes(
    linked,
    { op: "mergePrevious", paragraph: KEY_B },
    twoSide()
  )
  assert.equal(merged.status, "REFUSED")
  assert.equal(Buffer.from(merged.bytes).equals(Buffer.from(linked)), true)
  const broken = packageFromBody(
    `<w:p w14:paraId="${ID_A}" w14:textId="${TID_A}"><w:pPr>${PPR}</w:pPr><w:r><w:br w:type="page"/></w:r></w:p>` +
      carrier()
  )
  const removed = applyCanvasBytes(
    broken,
    { op: "deleteParagraph", paragraph: side.paragraphs[0].key },
    side
  )
  assert.equal(removed.status, "REFUSED")
  assert.equal(Buffer.from(removed.bytes).equals(Buffer.from(broken)), true)
  const tracked = packageFromBody(
    writing("a") +
      `<w:p w14:paraId="${ID_B}" w14:textId="${TID_B}"><w:pPr>${PPR}</w:pPr><w:ins><w:r><w:t>inserted</w:t></w:r></w:ins></w:p>` +
      carrier()
  )
  const kept = applyCanvasBytes(
    tracked,
    { op: "mergePrevious", paragraph: KEY_B },
    twoSide()
  )
  assert.equal(kept.status, "REFUSED")
  assert.equal(Buffer.from(kept.bytes).equals(Buffer.from(tracked)), true)
  const table = packageFromBody(
    `<w:tbl><w:tr><w:tc><w:p w14:paraId="${ID_A}" w14:textId="${TID_A}"><w:r><w:t></w:t></w:r></w:p></w:tc></w:tr></w:tbl>` +
      carrier()
  )
  const cell = applyCanvasBytes(
    table,
    { op: "deleteParagraph", paragraph: side.paragraphs[0].key },
    side
  )
  assert.equal(cell.status, "REFUSED")
  assert.equal(Buffer.from(cell.bytes).equals(Buffer.from(table)), true)
})

test("a numeric token, a comment, or a tracked mark stays unchanged", () => {
  const stay = (body, edit, side) => {
    const bytes = packageFromBody(body)
    const got = applyCanvasBytes(bytes, edit, side)
    assert.equal(got.status, "REFUSED")
    assert.equal(Buffer.from(got.bytes).equals(Buffer.from(bytes)), true)
  }
  for (const [text, at] of [
    ["A&#x26;B", 1],
    ["A&#x26;B", 2],
    ["caf&#233;", 0],
    ["&#128512;X", 1],
    ["a<!--c-->b", 1],
    ["a<?pi x?>b", 1],
    ["<![CDATA[ab]]>", 1],
  ])
    stay(
      writing(text) + carrier(),
      { op: "split", paragraph: KEY_A, at },
      mintSide()
    )
  const mark = (kind) =>
    `<w:rPr><w:${kind} w:id="9" w:author="A" w:date="2020-01-01T00:00:00Z"/></w:rPr>`
  for (const kind of ["del", "moveFrom", "moveTo"])
    stay(
      writing("a") +
        writing("next", `${PPR}${mark(kind)}`, ID_B, TID_B) +
        carrier(),
      { op: "mergePrevious", paragraph: KEY_B },
      twoSide()
    )
  stay(
    writing("", `${PPR}${mark("del")}`) + carrier(),
    { op: "deleteParagraph", paragraph: KEY_A },
    mintSide()
  )
  stay(
    writing("ab", `${PPR}${mark("ins")}`) + carrier(),
    { op: "split", paragraph: KEY_A, at: 1 },
    mintSide()
  )
  stay(
    writing("ab").replace(
      "</w:rPr>",
      '<w:rPrChange w:id="9" w:author="A" w:date="2020-01-01T00:00:00Z"/></w:rPr>'
    ) + carrier(),
    { op: "split", paragraph: KEY_A, at: 1 },
    mintSide()
  )
  stay(
    writing("ab").replace("<w:t>ab</w:t>", '<x:t xmlns:x="urn:x">ab</x:t>') +
      carrier(),
    { op: "split", paragraph: KEY_A, at: 1 },
    mintSide()
  )
  stay(
    writing("ab")
      .replace("<w:r><w:rPr>", "<x:r><w:rPr>")
      .replace("</w:r></w:p>", "</x:r></w:p>") + carrier(),
    { op: "split", paragraph: KEY_A, at: 1 },
    mintSide()
  )
})

test("the first words fill only an empty paragraph", () => {
  const minted = paintedCanvasBytes()
  const side = mintSide()
  const wrote = applyCanvasBytes(
    minted,
    { op: "writeText", paragraph: KEY_A, text: "Hi" },
    side
  )
  assert.equal(wrote.status, "APPLIED")
  const parts = paragraphsOf(wrote.bytes)
  assert.equal(contentOf(parts[0]), "Hi")
  assert.equal(contentOf(parts[1]), "")
  assert.deepEqual(wordIds(parts[0]), { paraId: ID_A, textId: TID_A })
  assert.equal(wrote.sidecar.paragraphs[0].key, KEY_A)
  assert.equal(parts[1].slice, paragraphsOf(minted)[1].slice)
  const spaced = applyCanvasBytes(
    minted,
    { op: "writeText", paragraph: KEY_A, text: " Hi " },
    side
  )
  assert.equal(spaced.status, "APPLIED")
  assert.match(mainXml(spaced.bytes), /<w:t xml:space="preserve"> Hi <\/w:t>/)
  assert.equal(contentOf(paragraphsOf(spaced.bytes)[0]), " Hi ")
  const ampersand = applyCanvasBytes(
    minted,
    { op: "writeText", paragraph: KEY_A, text: "R&D" },
    side
  )
  assert.equal(contentOf(paragraphsOf(ampersand.bytes)[0]), "R&D")
  const typed = fillPaintedText(minted, "Hi")
  const again = applyCanvasBytes(
    typed,
    { op: "writeText", paragraph: KEY_A, text: "Yo" },
    side
  )
  assert.equal(again.status, "REFUSED")
  assert.equal(Buffer.from(again.bytes).equals(Buffer.from(typed)), true)
  const carrierWrite = applyCanvasBytes(
    minted,
    { op: "writeText", paragraph: KEY_C, text: "No" },
    side
  )
  assert.equal(carrierWrite.status, "REFUSED")
  assert.equal(
    Buffer.from(carrierWrite.bytes).equals(Buffer.from(minted)),
    true
  )
  const broken = applyCanvasBytes(
    minted,
    { op: "writeText", paragraph: KEY_A, text: "a\nb" },
    side
  )
  assert.equal(broken.status, "REFUSED")
  const opened = split(minted, side, 0)
  const filled = applyCanvasBytes(
    opened.bytes,
    {
      op: "writeText",
      paragraph: opened.sidecar.paragraphs[0].key,
      text: "Hi",
    },
    opened.sidecar
  )
  assert.equal(filled.status, "APPLIED")
  assert.equal(contentOf(paragraphsOf(filled.bytes)[0]), "Hi")
  assert.equal(contentOf(paragraphsOf(filled.bytes)[1]), "")
})
