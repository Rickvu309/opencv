import {
  ERROR_CODES,
  nativeAdmission,
  type NativeWriter,
  type StoredPaperDocument,
} from "@workspace/domain"

import { CommandError } from "../platform/errors.js"

export function admitDocument(
  document: StoredPaperDocument,
  writer?: NativeWriter
) {
  if (document.version === 3)
    throw new CommandError(
      ERROR_CODES.CONFLICT,
      "This document needs the rich Paper editor. Nothing was changed."
    )
  const refusal = nativeAdmission(document, writer)
  if (refusal) throw new CommandError(ERROR_CODES.CONFLICT, refusal)
}
