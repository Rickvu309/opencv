import {
  branchKey,
  dismissRecovery,
  readBranch,
  rotateWriter,
  writeBranch,
  writingStorage,
  type Recovery,
} from "./canvas-branch.ts"
import { draftFromPage } from "./canvas-edit.ts"
import { commitWords, importSent, keepSent } from "./canvas-save-record.ts"
import { pageWords, serial } from "./canvas-save.ts"
import { openSheet, type CanvasState } from "./canvas-state.ts"
import { readWordPage } from "./package-read.ts"

export async function selectRecovery(
  docId: string,
  selected: Recovery | null
): Promise<CanvasState> {
  return serial(docId, async () => {
    const previous = readBranch(docId, writingStorage)
    const chosen = selected?.branch
    const page = chosen
      ? null
      : await readWordPage("page", docId, new AbortController().signal)
    if (!chosen && !page)
      throw new Error(
        "The saved page could not be read. Your words are still here."
      )
    if (!chosen)
      await keepSent(docId, (sent) =>
        sent.map((item) => ({ ...item, refused: true }))
      )
    const draft = chosen?.draft ?? (page ? draftFromPage(page) : null)
    if (!draft) throw new Error("The saved page could not be read.")
    const basis =
      chosen?.basis ??
      (page
        ? { revision: page.revision, words: pageWords(draft.blocks) }
        : null)
    rotateWriter(docId)
    const written = writeBranch(docId, draft, basis, {
      saved: chosen ? chosen.saved : draft,
      unsaved: chosen?.unsaved ?? [],
    })
    const local = await commitWords(
      docId,
      pageWords(draft.blocks),
      draft.blocks,
      basis
    )
    if (!written && local.local.transaction !== "complete")
      throw new Error(
        "This copy could not be kept. Your previous words are still available."
      )
    if (chosen?.sent.length && !(await importSent(docId, chosen)))
      throw new Error(
        "The original save could not be recovered. Your previous words are still available."
      )
    if (selected) dismissRecovery(docId, selected.identity)
    if (previous)
      dismissRecovery(
        docId,
        `${branchKey(docId, previous.writerId)}:${previous.snapshotId}`
      )
    const state = openSheet(docId, draft, basis?.revision ?? null)
    return {
      ...state,
      present: draft,
      basis,
      saved: chosen ? chosen.saved : draft,
      unsaved: chosen?.unsaved ?? [],
      typed: chosen ? pageWords(draft.blocks) !== basis?.words : false,
    }
  })
}
