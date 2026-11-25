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
  const refusal = nativeAdmission(document, writer)
  if (refusal) throw new CommandError(ERROR_CODES.CONFLICT, refusal)
}
