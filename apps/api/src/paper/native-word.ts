import { ERROR_CODES, type UserId } from "@workspace/domain/kernel"
import { CommandError } from "../platform/errors.js"
import { withRichSnapshot } from "./content-store.js"
import { compileOwnedFlowNativeDocx } from "./native-output/formatted-owned.js"
import type { RichSnapshotInput } from "./rich-snapshot.js"

export function downloadNativeWord(userId: UserId, input: RichSnapshotInput) {
  return withRichSnapshot(userId, input, async (snapshot) => {
    const {
      version: _version,
      schemaRevision: _schema,
      ...document
    } = snapshot.document
    void _version
    void _schema
    const result = await compileOwnedFlowNativeDocx({
      userId,
      document,
      generation: "rich",
    })
    if (result.kind === "refused")
      throw new CommandError(ERROR_CODES.CONFLICT, result.reason)
    const stem =
      snapshot.name
        .replace(/[\p{Cc}\p{Cf}/\\:*?"<>|]/gu, " ")
        .trim()
        .slice(0, 80) || "Paper"
    return {
      bytes: result.value,
      basis: snapshot.basis,
      filename: `${stem}.docx`,
    }
  })
}
