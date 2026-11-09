import assert from "node:assert/strict"

import {
  applyCanvasBytes,
  canvasMarks,
  contentOf,
  emptyTextNode,
  hasMark,
  hasNum,
  isCarrier,
  mainXml,
  pPrInner,
  pStyleOf,
  paragraphsOf,
  partsExceptMain,
  repack,
  runsOf,
  sectCount,
  wordIds,
} from "./paper-canvas-bytes.mjs"

export const FIRST = "e\u0301\u{1F600}X"
export const ID_A = "11111111"
export const TID_A = "11111112"
export const ID_B = "33333331"
export const TID_B = "33333332"
export const ID_C = "22222221"
export const BUMP = "2E5B0817"
export const KEY_A = "a11a11a1-a11a-4a11-8a11-a11a11a11a11"
export const KEY_B = "f66f66f6-f66f-4f66-8f66-f66f66f66f66"
export const KEY_C = "b22b22b2-b22b-4b22-8b22-b22b22b22b22"
export const MERGED_KEY = "e55e55e5-e55e-4e55-8e55-e55e55e55e55"
export const PPR = canvasMarks.PPR
export const SECT = canvasMarks.SECT
const splitKeys = {
  0: [
    "c00c00c0-c00c-400c-800c-c00c00c00c00",
    "d00d00d0-d00d-400d-800d-d00d00d00d00",
  ],
  1: [
    "c11c11c1-c11c-411c-811c-c11c11c11c11",
    "d11d11d1-d11d-411d-811d-d11d11d11d11",
  ],
  2: [
    "c22c22c2-c22c-422c-822c-c22c22c22c22",
    "d22d22d2-d22d-422d-822d-d22d22d22d22",
  ],
  3: [
    "c33c33c3-c33c-433c-833c-c33c33c33c33",
    "d33d33d3-d33d-433d-833d-d33d33d33d33",
  ],
  4: [
    "c44c44c4-c44c-444c-844c-c44c44c44c44",
    "d44d44d4-d44d-444d-844d-d44d44d44d44",
  ],
}
export const NUM = '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>'
export const MARK =
  '<w:rPr><w:rPrChange w:id="1" w:author="A" w:date="2020-01-01T00:00:00Z"><w:rPr/></w:rPrChange></w:rPr><w:pPrChange w:id="2" w:author="A" w:date="2020-01-01T00:00:00Z"><w:pPr><w:pStyle w:val="Normal"/></w:pPr></w:pPrChange>'
export const H1 = '<w:pStyle w:val="Heading1"/><w:jc w:val="center"/>'
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}
export function sidecar(items) {
  return {
    version: 2,
    paragraphs: items.map((row, ordinal) => ({
      key: row.key,
      ordinal,
      textIds: [...row.textIds],
    })),
  }
}
export function mintSide() {
  return sidecar([
    { key: KEY_A, textIds: [TID_A] },
    { key: KEY_C, textIds: ["22222222"] },
  ])
}
export function twoSide() {
  return sidecar([
    { key: KEY_A, textIds: [TID_A] },
    { key: KEY_B, textIds: [TID_B] },
    { key: KEY_C, textIds: ["22222222"] },
  ])
}
export function writing(text, pPr = PPR, paraId = ID_A, textId = TID_A) {
  return `<w:p w14:paraId="${paraId}" w14:textId="${textId}"><w:pPr>${pPr}</w:pPr><w:r><w:rPr>${canvasMarks.RPR}</w:rPr><w:t>${text}</w:t></w:r></w:p>`
}
export function carrier() {
  return `<w:p w14:paraId="${ID_C}" w14:textId="22222222"><w:pPr>${SECT}</w:pPr></w:p>`
}
export function replaceOnce(bytes, from, to) {
  const xml = mainXml(bytes)
  if (xml.split(from).length !== 2) throw new Error("text not unique")
  return repack(bytes, xml.replace(from, to))
}
export function replaceNth(bytes, from, to, index) {
  const xml = mainXml(bytes)
  let at = -1
  for (let i = 0; i <= index; i++) {
    at = xml.indexOf(from, at + 1)
    if (at < 0) throw new Error("nth text missing")
  }
  return repack(bytes, xml.slice(0, at) + to + xml.slice(at + from.length))
}
export function judgeMint(bytes) {
  const ps = paragraphsOf(bytes)
  const writingPs = ps.filter((paragraph) => !isCarrier(paragraph))
  const carriers = ps.filter(isCarrier)
  const ok =
    ps.length === 2 &&
    writingPs.length === 1 &&
    carriers.length === 1 &&
    ps[0] === writingPs[0] &&
    ps[1] === carriers[0] &&
    emptyTextNode(writingPs[0]) &&
    runsOf(carriers[0]).length === 0 &&
    contentOf(carriers[0]) === "" &&
    sectCount(bytes) === 1 &&
    !hasNum(writingPs[0]) &&
    !hasMark(writingPs[0]) &&
    pStyleOf(writingPs[0]) === "Normal" &&
    wordIds(writingPs[0]).paraId === ID_A &&
    wordIds(writingPs[0]).textId === TID_A &&
    wordIds(carriers[0]).paraId === ID_C
  return ok ? [] : ["mintShape"]
}
export function judgeSplit(
  beforeBytes,
  afterBytes,
  sideBefore,
  sideAfter,
  caret
) {
  const problems = []
  const beforeP = paragraphsOf(beforeBytes)
  const afterP = paragraphsOf(afterBytes)
  const index = beforeP.findIndex((paragraph) => !isCarrier(paragraph))
  const source = beforeP[index]
  const expected = [...contentOf(source)]
  const leftText = expected.slice(0, caret).join("")
  const rightText = expected.slice(caret).join("")
  const textOk =
    afterP.length === beforeP.length + 1 &&
    contentOf(afterP[0]) === leftText &&
    contentOf(afterP[1]) === rightText &&
    runsOf(afterP[0]).length === 1 &&
    runsOf(afterP[1]).length === 1 &&
    (leftText !== "" || emptyTextNode(afterP[0])) &&
    (rightText !== "" || emptyTextNode(afterP[1]))
  if (!textOk) problems.push("scalarCaret")
  if (
    afterP.length !== beforeP.length + 1 ||
    pPrInner(afterP[0]) !== pPrInner(source) ||
    pPrInner(afterP[1]) !== pPrInner(source)
  )
    problems.push("directProperties")
  const restBefore = beforeP.slice(index + 1)
  const restAfter = afterP.slice(2)
  if (!(
    restBefore.length === restAfter.length &&
    restBefore.every((paragraph, i) => paragraph.slice === restAfter[i].slice)
  ))
    problems.push("tailUntouched")
  const sectOk =
    afterP
      .slice(0, 2)
      .every(
        (paragraph) =>
          !isCarrier(paragraph) && !paragraph.slice.includes("<w:sectPr")
      ) &&
    sectCount(afterBytes) === sectCount(beforeBytes) &&
    afterP.some(isCarrier)
  if (!sectOk) problems.push("sectPrNotCopied")
  const side = sideAfter.paragraphs
  const oldFirst = sideBefore.paragraphs[0]
  const idsOk =
    afterP.length === beforeP.length + 1 &&
    wordIds(afterP[0]).paraId === wordIds(source).paraId &&
    wordIds(afterP[0]).textId === wordIds(source).textId &&
    wordIds(afterP[1]).paraId == null &&
    wordIds(afterP[1]).textId == null &&
    sideAfter.version === 2 &&
    side.length === sideBefore.paragraphs.length + 1 &&
    side[0].key !== oldFirst.key &&
    side[1].key !== oldFirst.key &&
    side[0].key !== side[1].key &&
    UUID.test(side[0].key) &&
    UUID.test(side[1].key) &&
    sameJson(side[0].textIds, oldFirst.textIds) &&
    side[1].textIds.length === 0 &&
    sideBefore.paragraphs
      .slice(1)
      .every(
        (row, i) =>
          side[i + 2].key === row.key &&
          sameJson(side[i + 2].textIds, row.textIds)
      ) &&
    !side.some((row) => row.key === oldFirst.key)
  if (!idsOk) problems.push("idsUnbumped")
  if (!partsExceptMain(beforeBytes, afterBytes)) problems.push("otherParts")
  return problems
}
export function judgeMerge(beforeBytes, afterBytes, sideBefore, sideAfter) {
  const problems = []
  const beforeP = paragraphsOf(beforeBytes)
  const afterP = paragraphsOf(afterBytes)
  const beforeWriting = beforeP.filter((paragraph) => !isCarrier(paragraph))
  const afterWriting = afterP.filter((paragraph) => !isCarrier(paragraph))
  const beforeRuns = [...runsOf(beforeWriting[0]), ...runsOf(beforeWriting[1])]
  const afterRuns = afterWriting.length === 1 ? runsOf(afterWriting[0]) : []
  const moved =
    afterWriting.length === beforeWriting.length - 1 &&
    afterRuns.length === beforeRuns.length &&
    afterRuns.every(
      (run, i) =>
        run.text === beforeRuns[i].text &&
        run.rPr === beforeRuns[i].rPr &&
        run.slice === beforeRuns[i].slice
    )
  if (!moved) problems.push("runMove")
  const beforeCarrier = beforeP.filter(isCarrier)
  const afterCarrier = afterP.filter(isCarrier)
  if (!(
    beforeCarrier.length === 1 &&
    afterCarrier.length === 1 &&
    beforeCarrier[0].slice === afterCarrier[0].slice &&
    sectCount(afterBytes) === 1 &&
    !afterWriting[0]?.slice.includes("<w:sectPr")
  ))
    problems.push("sectPrNotCopied")
  const side = sideAfter.paragraphs
  const idsOk =
    afterWriting.length === 1 &&
    wordIds(afterWriting[0]).paraId === wordIds(beforeWriting[0]).paraId &&
    wordIds(afterWriting[0]).textId === wordIds(beforeWriting[0]).textId &&
    side.length === sideBefore.paragraphs.length - 1 &&
    side[0].key !== sideBefore.paragraphs[0].key &&
    side[0].key !== sideBefore.paragraphs[1].key &&
    UUID.test(side[0].key) &&
    sameJson(side[0].textIds, sideBefore.paragraphs[0].textIds) &&
    side[1].key === sideBefore.paragraphs[2].key &&
    sameJson(side[1].textIds, sideBefore.paragraphs[2].textIds) &&
    !side.some(
      (row) =>
        row.key === sideBefore.paragraphs[0].key ||
        row.key === sideBefore.paragraphs[1].key
    )
  if (!idsOk) problems.push("idsUnbumped")
  if (!partsExceptMain(beforeBytes, afterBytes)) problems.push("otherParts")
  return problems
}
export function judgeDelete(
  beforeBytes,
  afterBytes,
  sideBefore,
  sideAfter,
  which
) {
  const beforeP = paragraphsOf(beforeBytes)
  const target = beforeP[which]
  const allowed = !isCarrier(target) && contentOf(target) === ""
  if (!allowed) {
    const same =
      Buffer.from(beforeBytes).equals(Buffer.from(afterBytes)) &&
      sameJson(sideBefore, sideAfter)
    return same ? [] : ["emptyDelete"]
  }
  const afterP = paragraphsOf(afterBytes)
  const problems = []
  const beforeCarrier = beforeP.filter(isCarrier)
  const afterCarrier = afterP.filter(isCarrier)
  const removed =
    afterP.length === beforeP.length - 1 &&
    afterCarrier.length === 1 &&
    afterCarrier[0].slice === beforeCarrier[0].slice &&
    afterP
      .filter((paragraph) => !isCarrier(paragraph))
      .map(contentOf)
      .join("\n") ===
      beforeP
        .filter((_, i) => i !== which && !isCarrier(beforeP[i]))
        .map(contentOf)
        .join("\n")
  if (!removed) problems.push("emptyDelete")
  const survivor = sideBefore.paragraphs.filter((_, i) => i !== which)
  const idsOk =
    sideAfter.paragraphs.length === survivor.length &&
    survivor.every(
      (row, i) =>
        sideAfter.paragraphs[i].key === row.key &&
        sameJson(sideAfter.paragraphs[i].textIds, row.textIds)
    ) &&
    !sideAfter.paragraphs.some(
      (row) => row.key === sideBefore.paragraphs[which].key
    ) &&
    afterP.every((paragraph) => {
      const match =
        beforeP.find((item) => item.slice === paragraph.slice) ??
        beforeP.find(
          (item) => wordIds(item).paraId === wordIds(paragraph).paraId
        )
      return (
        !wordIds(paragraph).paraId ||
        (match && wordIds(match).textId === wordIds(paragraph).textId)
      )
    })
  if (!idsOk) problems.push("idsUnbumped")
  if (!partsExceptMain(beforeBytes, afterBytes)) problems.push("otherParts")
  return problems
}
export function judgeRefusal(
  beforeBytes,
  afterBytes,
  sideBefore,
  sideAfter,
  code
) {
  const same =
    Buffer.from(beforeBytes).equals(Buffer.from(afterBytes)) &&
    sameJson(sideBefore, sideAfter)
  return same ? [] : [code]
}
export function removal(problems, code) {
  assert.deepEqual(problems, [code])
  assert.deepEqual(
    problems.filter((item) => item !== code),
    []
  )
}
export function split(bytes, side, caret, force = false) {
  return applyCanvasBytes(
    bytes,
    { op: "split", paragraph: side.paragraphs[0].key, at: caret },
    side,
    {
      keys: splitKeys[caret],
      force,
    }
  )
}
export function paperEdit(bytes, edit) {
  if (typeof edit.before !== "string" || edit.before.length === 0) return bytes
  if (/[\r\n\t]/.test(edit.after)) return bytes
  throw new Error("paper.edit accepted a span")
}

export function command(op, side) {
  if (op === "split") return { op, paragraph: side.paragraphs[0].key, at: 1 }
  if (op === "mergePrevious") return { op, paragraph: side.paragraphs[1].key }
  return { op: "deleteParagraph", paragraph: side.paragraphs[1].key }
}
export function bump(side) {
  return {
    ...side,
    paragraphs: side.paragraphs.map((row, i) =>
      i === 0
        ? { ...row, textIds: [...row.textIds, BUMP] }
        : { ...row, textIds: [...row.textIds] }
    ),
  }
}
export function judgeProposal(result, splitBytes) {
  const problems = []
  if (result.rows !== 0) problems.push("zeroRows")
  if (!Buffer.from(result.bytes).equals(Buffer.from(splitBytes)))
    problems.push("laterBytes")
  if (result.error !== "Basis conflict") problems.push("basisConflict")
  if (result.status !== "pending") problems.push("stillPending")
  return problems
}
export function reply(draft, answer) {
  if (answer.generation !== draft.generation) return { ...draft }
  if (answer.commandId !== draft.commandId) return { ...draft }
  if (answer.kind === "refusal") return { ...draft, saved: false }
  const matched =
    answer.kind === "receipt" &&
    answer.words === draft.words &&
    answer.stored === true
  return { ...draft, saved: matched }
}
export function judgeSession(winnerAfter, loserAfter, winner, loser) {
  const problems = []
  if (
    winnerAfter.saved !== true ||
    winnerAfter.words !== winner.words ||
    winnerAfter.commandId !== winner.commandId
  )
    problems.push("winnerSaved")
  if (
    loserAfter.words !== loser.words ||
    loserAfter.commandId !== loser.commandId ||
    loserAfter.saved !== false
  )
    problems.push("loserDraft")
  return problems
}
export function judgePaper(beforeBytes, afterBytes) {
  return Buffer.from(beforeBytes).equals(Buffer.from(afterBytes))
    ? []
    : ["paperEditEnter"]
}
